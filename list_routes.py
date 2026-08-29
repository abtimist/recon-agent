from fastapi import FastAPI
from api.main import app

def print_routes():
    for route in app.routes:
        if hasattr(route, "methods"):
            methods = ", ".join(route.methods - {"OPTIONS"})
            print(f"{methods} | {route.path} | {route.name}")
        else:
            # Mounts
            print(f"MOUNT | {route.path} | {route.name}")

if __name__ == "__main__":
    print_routes()
