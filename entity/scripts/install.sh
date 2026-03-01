#!/bin/bash
#
# Entity Installer
#
# One-liner: curl -fsSL https://entity.dev/install.sh | bash
#
# This script:
# 1. Detects OS (macOS, Linux, WSL2)
# 2. Checks for Node.js 20+ (offers nvm install if missing)
# 3. Checks for Git (offers package manager install if missing)
# 4. Clones the entity repo (or uses npm install)
# 5. Runs npm install
# 6. Launches the onboarding wizard
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print functions
info() {
  echo -e "${CYAN}[INFO]${NC} $1"
}

success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
  exit 1
}

# Detect OS
detect_os() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if grep -q Microsoft /proc/version 2>/dev/null; then
      OS="wsl"
    else
      OS="linux"
    fi
  else
    error "Unsupported OS: $OSTYPE"
  fi
  success "Detected OS: $OS"
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check Node.js version
check_node() {
  if command_exists node; then
    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [[ "$NODE_VERSION" -ge 20 ]]; then
      success "Node.js $(node -v) found"
      return 0
    else
      warn "Node.js $(node -v) found, but 20+ required"
    fi
  fi
  return 1
}

# Install Node.js via nvm
install_node() {
  info "Installing Node.js via nvm..."

  # Install nvm if not present
  if ! command_exists nvm && [[ ! -d "$HOME/.nvm" ]]; then
    info "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

    # Source nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  else
    # Source nvm if already installed
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  fi

  # Install Node 20
  nvm install 20
  nvm use 20

  success "Node.js $(node -v) installed"
}

# Check Git
check_git() {
  if command_exists git; then
    success "Git $(git --version | cut -d ' ' -f 3) found"
    return 0
  fi
  return 1
}

# Install Git
install_git() {
  info "Installing Git..."

  case $OS in
    macos)
      if command_exists brew; then
        brew install git
      else
        info "Installing Homebrew first..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        brew install git
      fi
      ;;
    linux|wsl)
      if command_exists apt-get; then
        sudo apt-get update
        sudo apt-get install -y git
      elif command_exists yum; then
        sudo yum install -y git
      elif command_exists dnf; then
        sudo dnf install -y git
      else
        error "Could not find package manager (apt/yum/dnf)"
      fi
      ;;
  esac

  success "Git installed"
}

# Main installation
main() {
  echo ""
  echo -e "${CYAN}"
  echo "  ███████╗███╗   ██╗████████╗██╗████████╗██╗   ██╗"
  echo "  ██╔════╝████╗  ██║╚══██╔══╝██║╚══██╔══╝╚██╗ ██╔╝"
  echo "  █████╗  ██╔██╗ ██║   ██║   ██║   ██║    ╚████╔╝ "
  echo "  ██╔══╝  ██║╚██╗██║   ██║   ██║   ██║     ╚██╔╝  "
  echo "  ███████╗██║ ╚████║   ██║   ██║   ██║      ██║   "
  echo "  ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝   ╚═╝      ╚═╝   "
  echo -e "${NC}"
  echo ""
  echo "  Entity Installer"
  echo ""
  echo "────────────────────────────────────────────────────"
  echo ""

  # Detect OS
  detect_os

  # Check/install Node.js
  if ! check_node; then
    echo ""
    read -p "Node.js 20+ is required. Install via nvm? (Y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Nn]$ ]]; then
      error "Node.js 20+ is required. Please install it and try again."
    fi
    install_node
  fi

  # Check/install Git
  if ! check_git; then
    echo ""
    read -p "Git is required. Install it? (Y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Nn]$ ]]; then
      error "Git is required. Please install it and try again."
    fi
    install_git
  fi

  echo ""
  info "Prerequisites satisfied!"
  echo ""

  # Determine installation directory
  INSTALL_DIR="$HOME/entity"

  echo "Installation directory: $INSTALL_DIR"
  read -p "Change directory? (enter new path or press Enter to continue) " -r NEW_DIR
  if [[ -n "$NEW_DIR" ]]; then
    INSTALL_DIR="$NEW_DIR"
  fi

  # Clone or pull repo
  if [[ -d "$INSTALL_DIR" ]]; then
    info "Directory exists, pulling latest..."
    cd "$INSTALL_DIR"
    git pull
  else
    info "Cloning Entity repository..."
    git clone https://github.com/entity-ai/entity.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi

  # Install dependencies
  info "Installing dependencies..."
  npm install

  success "Installation complete!"
  echo ""

  # Run onboarding
  echo "────────────────────────────────────────────────────"
  echo ""
  info "Starting onboarding wizard..."
  echo ""

  node scripts/onboard.js
}

# Run main
main "$@"
