#!/bin/bash
# scripts/deploy-blue.sh — 兼容旧调用, 等价 deploy-green.sh
# (V1 文档/脚本可能调 deploy-blue.sh; S5 统一后只保留 deploy-green.sh)
exec "$(dirname "$0")/deploy-green.sh" "$@"
