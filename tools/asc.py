#!/usr/bin/env python3
"""Small App Store Connect API client. No secrets in this file.

Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (path to AuthKey_XXXX.p8)

  python3 tools/asc.py bundle-ids
  python3 tools/asc.py capabilities <bundleIdResourceId>
  python3 tools/asc.py enable-capability <bundleIdResourceId> PUSH_NOTIFICATIONS|APPLE_ID_AUTH
  python3 tools/asc.py certs
  python3 tools/asc.py create-cert DEVELOPMENT|DISTRIBUTION request.csr out.cer
  python3 tools/asc.py apps
"""
import json, os, sys, time, urllib.request
import jwt  # PyJWT

KEY_ID = os.environ["ASC_KEY_ID"]; ISSUER = os.environ["ASC_ISSUER_ID"]
KEY = open(os.environ["ASC_KEY_PATH"]).read()
BASE = "https://api.appstoreconnect.apple.com/v1"

def token():
    now = int(time.time())
    return jwt.encode({"iss": ISSUER, "iat": now, "exp": now + 600, "aud": "appstoreconnect-v1"},
                      KEY, algorithm="ES256", headers={"kid": KEY_ID, "typ": "JWT"})

def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method,
                                 data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} -> {e.code}: {e.read().decode()}")

def main(a):
    cmd = a[0] if a else "help"
    if cmd == "bundle-ids":
        for b in call("GET", "/bundleIds?limit=200")["data"]:
            print(b["id"], b["attributes"]["identifier"], b["attributes"]["name"])
    elif cmd == "capabilities":
        for c in call("GET", f"/bundleIds/{a[1]}/bundleIdCapabilities")["data"]:
            print(c["id"], c["attributes"]["capabilityType"])
    elif cmd == "enable-capability":
        r = call("POST", "/bundleIdCapabilities", {"data": {"type": "bundleIdCapabilities",
             "attributes": {"capabilityType": a[2]},
             "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": a[1]}}}}})
        print("enabled", r["data"]["attributes"]["capabilityType"])
    elif cmd == "certs":
        for c in call("GET", "/certificates?limit=200")["data"]:
            at = c["attributes"]; print(c["id"], at["certificateType"], at["name"], "expires", at["expirationDate"][:10])
    elif cmd == "create-cert":
        csr = "".join(l for l in open(a[2]).read().splitlines() if not l.startswith("-----"))
        r = call("POST", "/certificates", {"data": {"type": "certificates",
             "attributes": {"certificateType": a[1], "csrContent": csr}}})
        import base64
        open(a[3], "wb").write(base64.b64decode(r["data"]["attributes"]["certificateContent"]))
        print("created", r["data"]["id"], r["data"]["attributes"]["name"], "->", a[3])
    elif cmd == "apps":
        for x in call("GET", "/apps")["data"]:
            print(x["id"], x["attributes"]["bundleId"], x["attributes"]["name"])
    else:
        print(__doc__)

if __name__ == "__main__":
    main(sys.argv[1:])
