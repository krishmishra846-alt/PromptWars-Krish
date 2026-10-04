import io

def test_upload_dangerous_extension_blocked(operator_client):
    """Verify security check blocks executable or script file uploads."""
    malicious_file = io.BytesIO(b"echo 'malicious script'")
    res = operator_client.post(
        "/api/upload",
        files={"file": ("exploit.exe", malicious_file, "application/x-msdownload")}
    )
    assert res.status_code == 400
    assert "Security Policy" in res.json()["detail"]

def test_upload_shell_script_blocked(operator_client):
    """Verify security check blocks shell scripts."""
    sh_file = io.BytesIO(b"#!/bin/bash\nrm -rf /")
    res = operator_client.post(
        "/api/upload",
        files={"file": ("hack.sh", sh_file, "text/x-shellscript")}
    )
    assert res.status_code == 400
    assert "Security Policy" in res.json()["detail"]

def test_upload_permitted_text_file(operator_client):
    """Verify permitted text/evidence documents are processed successfully."""
    valid_file = io.BytesIO(b"Log entry: Sensor temperature nominal at 22.4C")
    res = operator_client.post(
        "/api/upload",
        files={"file": ("sensor_log.txt", valid_file, "text/plain")}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["filename"] == "sensor_log.txt"
    assert "url" in data
    assert data["size_bytes"] > 0

def test_upload_empty_filename_rejected(operator_client):
    """Verify upload fails gracefully when filename is empty."""
    empty_file = io.BytesIO(b"content")
    res = operator_client.post(
        "/api/upload",
        files={"file": ("", empty_file, "text/plain")}
    )
    assert res.status_code in [400, 422]
