#!/bin/bash
# ============================================================
# Treina modelo OpenWakeWord customizado para "nilo"
# Rodar dentro do WSL (Ubuntu)
# ============================================================

set -e

WAKE_WORD="nilo"
WORK_DIR="$HOME/wakeword-training"
VENV_DIR="$WORK_DIR/venv"

echo "=========================================="
echo "  Treinando wake word: $WAKE_WORD"
echo "=========================================="
echo ""

# 1. Criar venv
echo "[1/5] Criando ambiente virtual..."
mkdir -p "$WORK_DIR"
python3 -m venv "$VENV_DIR" 2>/dev/null || {
    sudo apt install -y python3-venv python3-full
    python3 -m venv "$VENV_DIR"
}
source "$VENV_DIR/bin/activate"

# 2. Instalar dependências
echo "[2/5] Instalando dependências (pode demorar)..."
pip install --quiet --upgrade pip
pip install --quiet openwakeword

# 3. Clonar repo pra usar notebooks de treino
echo "[3/5] Preparando dados de treino..."
OWW_DIR="$WORK_DIR/openWakeWord"
if [ ! -d "$OWW_DIR" ]; then
    git clone --depth 1 https://github.com/dscripka/openWakeWord.git "$OWW_DIR"
fi

# 4. Treinar
echo "[4/5] Treinando modelo '$WAKE_WORD'..."

cat > "$WORK_DIR/train.py" << 'PYTHON_SCRIPT'
import sys
import os

WAKE_WORD = "nilo"
WORK_DIR = os.path.expanduser("~/wakeword-training")
MODEL_DIR = os.path.join(WORK_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# Tentar treino automático via openwakeword
try:
    # Verificar se o módulo de treino está disponível
    from openwakeword.utils import download_models
    print("OpenWakeWord instalado com sucesso.")

    # O treino automático precisa de ferramentas adicionais
    # Vamos tentar instalar e usar
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet",
                    "torch", "torchaudio", "speechbrain", "mutagen"], check=False)

    # Tentar usar a API de treino se disponível
    try:
        sys.path.insert(0, os.path.join(WORK_DIR, "openWakeWord"))
        from openwakeword import train
        print(f"Treinando '{WAKE_WORD}'...")
        # Usar treino automático
        train.train(
            target_phrase=WAKE_WORD,
            output_dir=MODEL_DIR,
        )
        print(f"✅ Modelo salvo em: {MODEL_DIR}/{WAKE_WORD}.onnx")
    except (ImportError, AttributeError) as e:
        print(f"API de treino não disponível: {e}")
        raise

except Exception as e:
    print(f"\n⚠️  Treino automático falhou: {e}")
    print(f"\n{'='*50}")
    print(f"  ALTERNATIVA: Google Colab (mais fácil)")
    print(f"{'='*50}")
    print(f"")
    print(f"1. Abra este link no navegador:")
    print(f"   https://colab.research.google.com/github/dscripka/openWakeWord/blob/main/notebooks/automatic_model_training.ipynb")
    print(f"")
    print(f"2. No notebook, mude o wake word para: {WAKE_WORD}")
    print(f"   (Procure por 'my_wake_word' e troque)")
    print(f"")
    print(f"3. Execute todas as células (Runtime → Run all)")
    print(f"   Demora ~30-60 min")
    print(f"")
    print(f"4. Baixe o arquivo .onnx gerado")
    print(f"")
    print(f"5. Coloque em:")
    print(f"   C:\\Users\\caslu\\Documents\\projects\\stick-demo\\services\\wakeword\\{WAKE_WORD}.onnx")
    print(f"")
    print(f"6. Reinicie o serviço de wakeword")
    print(f"")
    print(f"O servidor já detecta o .onnx automaticamente!")

PYTHON_SCRIPT

python3 "$WORK_DIR/train.py"

echo ""
echo "=========================================="
echo "  Processo finalizado!"
echo "=========================================="
