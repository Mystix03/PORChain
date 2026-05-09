import httpx
import re
from fastapi import Request, Response
from fastapi.responses import HTMLResponse, FileResponse
import pathlib
import logging

log = logging.getLogger("por-chain")

# Keywords that indicate a mobile browser
MOBILE_RE = re.compile(r".*(iphone|android|mobile|phone).*", re.IGNORECASE)

# The local React dev server
VITE_SERVER = "http://127.0.0.1:4000"

# List of paths that should ALWAYS be handled by the Python Backend (APIs)
# If a path starts with any of these, we don't proxy it.
API_PREFIXES = [
    "/node_state", "/config", "/peers", "/node/registry", 
    "/chain", "/task", "/vouch", "/coldstart", "/wallet", 
    "/broadcast", "/simulate", "/audit", "/terminal", "/docs", "/openapi.json"
]

async def handle_device_routing(request: Request, frontend_path: pathlib.Path):
    """
    Detects if the user is on mobile or laptop and serves the appropriate frontend.
    """
    path = request.url.path
    user_agent = request.headers.get("user-agent", "")
    is_mobile = MOBILE_RE.match(user_agent)

    # Check if this is an API call
    is_api = any(path.startswith(prefix) for prefix in API_PREFIXES)

    if is_mobile and not is_api:
        # Proxy EVERYTHING to the React App (apps/web)
        # This includes scripts, styles, and images that React needs
        target_url = f"{VITE_SERVER}{path}"
        if request.query_params:
            target_url += f"?{request.query_params}"
            
        try:
            async with httpx.AsyncClient() as client:
                # We forward the request exactly as it came in
                res = await client.get(target_url, follow_redirects=True)
                
                # Return the content with the correct type (CSS, JS, HTML, etc.)
                return Response(
                    content=res.content,
                    status_code=res.status_code,
                    headers=dict(res.headers)
                )
        except Exception as e:
            return HTMLResponse(
                content=f"<h1>Mobile Dashboard Link Broken</h1><p>Ensure 'npm run dev' is running.</p><p>Error: {e}</p>",
                status_code=503
            )
    
    # DEFAULT BEHAVIOR (Laptop or API)
    if path == "/":
        # Serve the Vanilla JS app (frontend/)
        index_file = frontend_path / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return HTMLResponse(content="<h1>Frontend Not Found</h1>", status_code=404)
    
    # If it's not the root and not proxied, we return None 
    # to let the main app handle it (for APIs).
    return None
