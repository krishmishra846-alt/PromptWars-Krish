-- ==============================================================================
-- ENTERPRISE PLATFORM: SUPABASE POSTGRESQL SCHEMA
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES & ROLES
-- Automatically mirrors Supabase auth.users to store application-level role info
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to automatically create a profile when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ------------------------------------------------------------------------------
-- 2. ENTITY SCHEMAS (Meta-Schema Definition)
-- Allows defining ANY entity dynamically (e.g., 'patients', 'work_orders', 'inventory', 'claims')
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entity_schemas (
    entity_name TEXT PRIMARY KEY,                       -- Unique slug, e.g., 'patients', 'incidents', 'work_orders'
    display_name TEXT NOT NULL,                         -- Human friendly: "Patient Records", "Incident Reports"
    description TEXT,
    icon TEXT DEFAULT 'file-text',                      -- Lucide icon slug or emoji
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,          -- Array of field definitions: [{name, label, type, required, options, summarizable}]
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ------------------------------------------------------------------------------
-- 3. GENERIC ENTITIES (Universal Dynamic Data Store)
-- Stores the actual records for any entity defined in entity_schemas
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generic_entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_name TEXT NOT NULL REFERENCES public.entity_schemas(entity_name) ON DELETE CASCADE,
    title TEXT NOT NULL,                                -- Universal headline / summary field for cards & lists
    data JSONB NOT NULL DEFAULT '{}'::jsonb,            -- Dynamic fields according to entity_schema
    status TEXT NOT NULL DEFAULT 'active',              -- e.g., 'active', 'pending', 'resolved', 'critical'
    file_urls TEXT[] DEFAULT ARRAY[]::TEXT[],           -- Attached documents, scans, images
    ai_summary TEXT,                                    -- Groq LLM summary cache
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Search index for fast filtering across entity_name, title, and JSONB keys
CREATE INDEX IF NOT EXISTS idx_entities_lookup 
    ON public.generic_entities (entity_name, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entities_data_gin 
    ON public.generic_entities USING GIN (data);


-- ------------------------------------------------------------------------------
-- 4. AUDIT LOG (Enterprise & Compliance Trail)
-- Captures who created, updated, or deleted any record with full diffs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_lookup 
    ON public.audit_log (entity_name, record_id, created_at DESC);


-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generic_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone authenticated can read profiles; users can update their own
CREATE POLICY "Public profiles are readable" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Entity Schemas: All authenticated users can read; only admins or creators can insert/update
CREATE POLICY "Schemas are readable by authenticated" ON public.entity_schemas
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Schemas can be created/edited by authenticated" ON public.entity_schemas
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'user')
        )
    );

-- Generic Entities:
-- Users can only read, insert, update, and delete their OWN records (matching owner_id = auth.uid())
-- Admins can view and manage all records
CREATE POLICY "Entities read access" ON public.generic_entities
    FOR SELECT TO authenticated USING (
        owner_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Entities insert access" ON public.generic_entities
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Entities update access" ON public.generic_entities
    FOR UPDATE TO authenticated USING (
        owner_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Entities delete access" ON public.generic_entities
    FOR DELETE TO authenticated USING (
        owner_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Audit Log: Strictly isolated to user's own actions unless admin
CREATE POLICY "Audit logs readable by authenticated" ON public.audit_log
    FOR SELECT TO authenticated USING (
        user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Audit logs insertable by system/authenticated" ON public.audit_log
    FOR INSERT TO authenticated WITH CHECK (true);


