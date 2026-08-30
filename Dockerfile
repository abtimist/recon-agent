FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy dependency files
COPY pyproject.toml .
COPY uv.lock .
COPY README.md .

# Install dependencies using uv
RUN uv sync --frozen --all-extras

# Copy the rest of the application
COPY . .

# Expose port for FastAPI
EXPOSE 8000

# The default command runs the API
CMD ["uv", "run", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
