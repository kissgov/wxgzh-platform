// apps/server/eslint-local-rules.js
// eslint-plugin-local-rules 入口 — re-export 项目自定义规则
// 规则实现位于 ./eslint-rules/<name>.js
module.exports = {
  'no-any-input': require('./eslint-rules/no-any-input'),
};
