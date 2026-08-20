#!/bin/bash
# ============================================================
# Treina modelo OpenWakeWord customizado para "nilo"
# Rodar dentro do WSL (Ubuntu)
# Uso: bash train-wakeword.sh
# Resultado: models/nilo.onnx
# ============================================================

set -e

WAKE_WORD="nilo"
OUTPUT_DIR="$HOME/wakeword-training"
MODEL_OUTPUT="$OUTPUT_DIR/models"

echo "=========================================="
echo "  Treinando wake word: $WAKE_WORD"
echo "=========================================="
echo ""

# 1. Instalar dependências
echo "[1/5] Instalando dependências..."
pip install --quiet openwakeword torch torchaudio piper-tts optuna onnx onnxruntime 2>/dev/null || {
    pip3 install --quiet openwakeword torch torchaudio piper-tts optuna onnx onnxruntime
}

# 2. Criar diretórios
echo "[2/5] Preparando diretórios..."
mkdir -p "$OUTPUT_DIR"
mkdir -p "$MODEL_OUTPUT"

# 3. Script Python de treino
echo "[3/5] Gerando dados sintéticos e treinando..."

cat > "$OUTPUT_DIR/train.py" << 'PYTHON_SCRIPT'
import os
import sys
import json
import numpy as np

WAKE_WORD = "nilo"
OUTPUT_DIR = os.path.expanduser("~/wakeword-training")
MODEL_DIR = os.path.join(OUTPUT_DIR, "models")

def main():
    try:
        from openwakeword.train import train_custom_model
        print(f"Treinando modelo para '{WAKE_WORD}' via API...")

        model_path = train_custom_model(
            wake_word=WAKE_WORD,
            output_dir=MODEL_DIR,
            n_samples=1500,
            n_epochs=100,
            target_accuracy=0.5,
            target_recall=0.3,
        )
        print(f"\n✅ Modelo salvo em: {model_path}")
        return model_path

    except ImportError:
        print("API de treino não disponível. Usando notebook approach...")
    except Exception as e:
        print(f"Erro na API de treino: {e}")
        print("Tentando abordagem alternativa...")

    # Alternativa: usar o notebook de treino automático
    try:
        import subprocess

        # Clonar o repo se necessário
        oww_dir = os.path.join(OUTPUT_DIR, "openWakeWord")
        if not os.path.exists(oww_dir):
            print("Clonando openWakeWord...")
            subprocess.run(["git", "clone", "https://github.com/dscripka/openWakeWord.git", oww_dir], check=True)

        # Usar o script de treino do repo
        train_script = os.path.join(oww_dir, "openwakeword", "train.py")
        if os.path.exists(train_script):
            print(f"Executando treino via script do repo...")
            subprocess.run([
                sys.executable, train_script,
                "--wake_word", WAKE_WORD,
                "--output_dir", MODEL_DIR,
            ], check=True)
        else:
            print("Script de treino não encontrado no repo.")
            print("\n📋 Alternativa manual:")
            print(f"1. Acesse: https://colab.research.google.com/github/dscripka/openWakeWord/blob/main/notebooks/automatic_model_training.ipynb")
            print(f"2. Mude o wake word para: {WAKE_WORD}")
            print(f"3. Execute o notebook")
            print(f"4. Baixe o modelo .onnx gerado")
            print(f"5. Coloque em: {MODEL_DIR}/{WAKE_WORD}.onnx")

    except Exception as e:
        print(f"Erro: {e}")
        print("\n📋 Use o Google Colab como alternativa:")
        print(f"https://colab.research.google.com/github/dscripka/openWakeWord/blob/main/notebooks/automatic_model_training.ipynb")

if __name__ == "__main__":
    main()
PYTHON_SCRIPT

python3 "$OUTPUT_DIR/train.py"

# 4. Copiar modelo pro projeto
echo ""
echo "[4/5] Verificando modelo..."
ONNX_FILE="$MODEL_DIR/${WAKE_WORD}.onnx"
if [ -f "$ONNX_FILE" ]; then
    # Converter path WSL → Windows
    WIN_PATH=$(wslpath -w "$ONNX_FILE" 2>/dev/null || echo "$ONNX_FILE")
    echo "✅ Modelo treinado: $ONNX_FILE"
    echo "   Windows path: $WIN_PATH"
    echo ""
    echo "[5/5] Copie o modelo para o projeto:"
    echo "   cp $ONNX_FILE /mnt/c/Users/caslu/Documents/projects/stick-demo/services/wakeword/${WAKE_WORD}.onnx"
else
    echo "⚠️  Modelo não encontrado em $ONNX_FILE"
    echo "   Siga as instruções acima para treinar via Colab."
fi

echo ""
echo "=========================================="
echo "  Treino finalizado!"
echo "=========================================="
