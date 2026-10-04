FROM python:3.12-slim
ENV PIP_CACHE_DIR=/ocv-deps/pip PYTHONPYCACHEPREFIX=/ocv-deps/pycache PYTHONUNBUFFERED=1
WORKDIR /app
COPY services/fastapi/requirements.txt ./
RUN pip install -r requirements.txt
COPY services/fastapi/main.py ./
COPY services/fastapi/data ./data
COPY infra/protocols/rice.proto ./
RUN python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. rice.proto
CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8000","--workers","1","--limit-concurrency","16"]
