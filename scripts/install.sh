#!/bin/sh
set -eu

CDN_BASE_URL="${SENSOS_RELEASES_URL:-https://releases.sensos.dev}"
GITHUB_REPOSITORY="${SENSOS_GITHUB_REPOSITORY:-sensos-ai/sensos}"
INSTALL_DIR="${SENSOS_INSTALL_DIR:-$HOME/.local/bin}"
REQUESTED_RELEASE="${SENSOS_RELEASE:-latest}"
NON_INTERACTIVE="${SENSOS_NON_INTERACTIVE:-false}"

tmp_dir=""
path_action="already"
path_profile=""

step() { printf '==> %s\n' "$1"; }
warn() { printf 'warning: %s\n' "$1" >&2; }
fail() { printf 'error: %s\n' "$1" >&2; exit 1; }

usage() {
  cat <<'EOF'
Install the Sensos CLI.

Usage:
  install.sh [VERSION|CHANNEL]
  install.sh --release VERSION|CHANNEL
  install.sh --version VERSION|CHANNEL

VERSION may include or omit the leading "v". CHANNEL is "latest" or
"canary".

Environment:
  SENSOS_RELEASE             Release to install (default: latest)
  SENSOS_INSTALL_DIR         Binary directory (default: ~/.local/bin)
  SENSOS_NON_INTERACTIVE     Skip the PATH prompt when true, 1, or yes
  SENSOS_RELEASES_URL        Override the primary release CDN
  SENSOS_GITHUB_REPOSITORY   Override the GitHub mirror repository
EOF
}

parse_args() {
  positional_seen=false
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --release|--version)
        [ "$#" -ge 2 ] || fail "$1 requires a value"
        [ "$positional_seen" = false ] || fail 'provide the release only once'
        REQUESTED_RELEASE="$2"
        positional_seen=true
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      --*) fail "unknown option: $1" ;;
      *)
        [ "$positional_seen" = false ] || fail 'provide the release only once'
        REQUESTED_RELEASE="$1"
        positional_seen=true
        ;;
    esac
    shift
  done
}

normalize_release() {
  case "$1" in
    latest|canary) printf '%s\n' "$1" ;;
    v*) printf '%s\n' "${1#v}" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

validate_release() {
  case "$1" in latest|canary) return ;; esac
  if ! printf '%s\n' "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$'; then
    fail "invalid release '$1'; expected latest, canary, or a semantic version"
  fi
}

detect_target() {
  case "$(uname -s)" in
    Linux) os="linux" ;;
    Darwin) os="darwin" ;;
    *) fail "unsupported operating system: $(uname -s)" ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) fail "unsupported architecture: $(uname -m)" ;;
  esac
  printf '%s-%s\n' "$os" "$arch"
}

download() {
  url="$1"
  output="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --connect-timeout 10 --max-time 300 "$url" -o "$output"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -T 300 -O "$output" "$url"
  else
    fail 'curl or wget is required'
  fi
}

download_text() {
  url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --connect-timeout 10 --max-time 30 "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -T 30 -O - "$url"
  else
    fail 'curl or wget is required'
  fi
}

resolve_release() {
  requested="$1"
  case "$requested" in
    latest|canary)
      if resolved="$(download_text "$CDN_BASE_URL/$requested.txt" 2>/dev/null)"; then
        resolved="$(normalize_release "$(printf '%s' "$resolved" | tr -d '[:space:]')")"
        validate_release "$resolved"
        printf '%s\n' "$resolved"
      else
        warn "could not resolve $requested from the release CDN; using the GitHub $requested release"
        printf '%s\n' "$requested"
      fi
      ;;
    *) printf '%s\n' "$requested" ;;
  esac
}

github_tag() {
  case "$1" in
    latest|canary) printf '%s\n' "$1" ;;
    *) printf 'v%s\n' "$1" ;;
  esac
}

download_archive() {
  release="$1"
  asset="$2"
  output="$3"
  primary_url="$CDN_BASE_URL/$release/$asset"

  if download "$primary_url" "$output" && download "$CDN_BASE_URL/$release/SHA256SUMS" "$tmp_dir/SHA256SUMS"; then return; fi

  tag="$(github_tag "$release")"
  if [ "$tag" = latest ]; then
    fallback_url="https://github.com/$GITHUB_REPOSITORY/releases/latest/download/$asset"
  else
    fallback_url="https://github.com/$GITHUB_REPOSITORY/releases/download/$tag/$asset"
  fi
  warn 'release CDN download failed; trying GitHub Releases'
  download "$fallback_url" "$output" || fail "could not download $asset"
  checksum_url="${fallback_url%/*}/SHA256SUMS"
  download "$checksum_url" "$tmp_dir/SHA256SUMS" || fail 'could not download GitHub release checksums'
}

verify_archive() {
  asset="$1"
  archive="$2"
  expected="$(awk -v file="$asset" '$2 == file { print $1 }' "$tmp_dir/SHA256SUMS")"
  printf '%s\n' "$expected" | grep -Eq '^[0-9a-f]{64}$' || fail 'missing or invalid release checksum'
  [ "$(printf '%s\n' "$expected" | wc -l | tr -d ' ')" = 1 ] || fail 'duplicate release checksum'
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$archive" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$archive" | awk '{print $1}')"
  else
    fail 'sha256sum or shasum is required to verify the download'
  fi
  [ "$actual" = "$expected" ] || fail 'release checksum mismatch; refusing to install'
}

pick_profile() {
  case "$(uname -s):${SHELL:-}" in
    Darwin:*/zsh) printf '%s\n' "$HOME/.zprofile" ;;
    Darwin:*/bash) printf '%s\n' "$HOME/.bash_profile" ;;
    Linux:*/zsh) printf '%s\n' "$HOME/.zshrc" ;;
    Linux:*/bash) printf '%s\n' "$HOME/.bashrc" ;;
    *) printf '%s\n' "$HOME/.profile" ;;
  esac
}

is_non_interactive() {
  case "$NON_INTERACTIVE" in 1|true|TRUE|yes|YES) return 0 ;; *) return 1 ;; esac
}

confirm_path_update() {
  is_non_interactive && return 1
  [ -r /dev/tty ] || return 1
  printf '%s' "Add $INSTALL_DIR to PATH in your shell profile? [Y/n] " >/dev/tty
  IFS= read -r answer </dev/tty || return 1
  case "$answer" in ''|y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

configure_path() {
  case ":$PATH:" in *":$INSTALL_DIR:"*) return ;; esac
  if ! confirm_path_update; then
    path_action="manual"
    return
  fi

  profile="$(pick_profile)"
  path_profile="$profile"
  path_line="export PATH=\"$INSTALL_DIR:\$PATH\""
  if [ -f "$profile" ] && grep -F "$path_line" "$profile" >/dev/null 2>&1; then
    path_action="configured"
    return
  fi
  {
    printf '\n# Sensos CLI\n'
    printf '%s\n' "$path_line"
  } >>"$profile"
  path_action="added"
}

cleanup() { [ -z "$tmp_dir" ] || rm -rf "$tmp_dir"; }

main() {
  parse_args "$@"
  requested="$(normalize_release "$REQUESTED_RELEASE")"
  validate_release "$requested"
  target="$(detect_target)"
  resolved="$(resolve_release "$requested")"
  asset="sensos-$target.tar.gz"

  tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/sensos-install.XXXXXX")"
  trap cleanup EXIT HUP INT TERM
  archive="$tmp_dir/$asset"

  step "Downloading Sensos $resolved for $target"
  download_archive "$resolved" "$asset" "$archive"
  verify_archive "$asset" "$archive"
  archive_contents="$(tar -tzf "$archive")" || fail 'downloaded release is not a valid tar.gz archive'
  [ "$archive_contents" = sensos ] || fail 'release archive must contain only the sensos executable'
  tar -xzf "$archive" -C "$tmp_dir"
  [ -f "$tmp_dir/sensos" ] || fail 'release archive does not contain a sensos executable'

  mkdir -p "$INSTALL_DIR"
  chmod +x "$tmp_dir/sensos"
  mv "$tmp_dir/sensos" "$INSTALL_DIR/sensos"
  configure_path

  step "Installed Sensos to $INSTALL_DIR/sensos"
  case "$path_action" in
    added) printf 'Restart your shell or run: source %s\n' "$path_profile" ;;
    manual) printf 'Add %s to your PATH to run sensos from any directory.\n' "$INSTALL_DIR" ;;
  esac
}

main "$@"
