FROM mcr.microsoft.com/playwright/python:v1.53.0-jammy

WORKDIR /app

COPY worker/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY worker/edc_worker.py /app/edc_worker.py

ENV PYTHONUNBUFFERED=1

CMD ["python", "/app/edc_worker.py"]
