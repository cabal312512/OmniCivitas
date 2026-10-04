from fastapi import FastAPI
app = FastAPI()
@app.get("/hamster/ration")
def feed(weight: int = 70):
    return {"grams": max(1, weight // 35), "shift": "night"}
