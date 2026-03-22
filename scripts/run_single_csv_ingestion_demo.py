import argparse
import json
import urllib.error
import urllib.request


def main() -> None:
    parser = argparse.ArgumentParser(description="Run single CSV -> recommendation ingestion demo")
    parser.add_argument("--csv", required=True, help="Path to company emissions CSV")
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--project-name", default="CSV Emissions Plan")
    parser.add_argument("--location", default="India")
    parser.add_argument("--api-url", default="http://localhost:8000")
    args = parser.parse_args()

    boundary = "----CarbonSenseBoundary7MA4YWxkTrZu0gW"

    with open(args.csv, "rb") as f:
        csv_bytes = f.read()

    fields = [
        ("organization_id", args.organization_id.encode("utf-8")),
        ("user_id", args.user_id.encode("utf-8")),
        ("project_name", args.project_name.encode("utf-8")),
        ("location", args.location.encode("utf-8")),
        ("time_horizon_years", b"15"),
    ]

    body = bytearray()
    for name, value in fields:
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8")
        )
        body.extend(value)
        body.extend(b"\r\n")

    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(
        b'Content-Disposition: form-data; name="file"; filename="company_emissions_single.csv"\r\n'
    )
    body.extend(b"Content-Type: text/csv\r\n\r\n")
    body.extend(csv_bytes)
    body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    req = urllib.request.Request(
        f"{args.api_url}/ingestion/company-csv/recommendations",
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
            print(json.dumps(payload, indent=2))
    except urllib.error.HTTPError as e:
        print(e.code)
        print(e.read().decode("utf-8"))


if __name__ == "__main__":
    main()
