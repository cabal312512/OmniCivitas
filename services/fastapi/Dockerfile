FROM python:3.12-slim
ENV PIP_CACHE_DIR=/ocv-deps/pip PYTHONPYCACHEPREFIX=/ocv-deps/pycache PYTHONUNBUFFERED=1 OCV_SHARED_ROOT=/app
WORKDIR /app
COPY services/fastapi/requirements.txt ./
RUN pip install -r requirements.txt
COPY services/fastapi/main.py ./
COPY services/fastapi/data ./data
COPY services/fastapi/desk ./desk
COPY config/4/7.py config/4/old2.py ./config/4/
COPY pinia/unused2/old.py ./pinia/unused2/old.py
COPY pcakage/stock2/2.py ./pcakage/stock2/2.py
COPY infra/protocols/rice.proto ./
RUN python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. rice.proto
CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8000","--workers","1","--limit-concurrency","16"]
