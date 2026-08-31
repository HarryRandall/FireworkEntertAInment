FROM python:3.11-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg libgomp1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /worker

COPY requirements.txt smoke_playwright.py ./
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install --with-deps chromium \
  && python smoke_playwright.py

COPY worker.py media_analysis.py reconstruction.py engine_validation.py ./

CMD ["python", "worker.py"]
