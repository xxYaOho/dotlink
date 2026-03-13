function bashScript() {
  const cword = '${cword}';
  const top = '${top}';
  const words1 = '${words[1]}';
  return `# dotlink bash completion
_dotlink_completions() {
  local cur prev words cword
  _init_completion || return

  local top="module link exec local completions migrate"

  if [[ ${cword} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${top}" -- "$cur") )
    return
  fi

  case "${words1}" in
    module)
      COMPREPLY=( $(compgen -W "list create" -- "$cur") )
      ;;
    link)
      COMPREPLY=( $(compgen -W "list add remove update" -- "$cur") )
      ;;
    exec)
      COMPREPLY=( $(compgen -W "plan apply doctor fix" -- "$cur") )
      ;;
    completions)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "$cur") )
      ;;
    local)
      COMPREPLY=()
      ;;
    migrate)
      COMPREPLY=( $(compgen -W "import" -- "$cur") )
      ;;
  esac
}

complete -F _dotlink_completions dotlink
`;
}

function zshScript() {
  return `#compdef dotlink

_dotlink() {
  local -a subcommands
  subcommands=(
    'module:模块操作'
    'link:链接操作'
    'exec:执行与检查'
    'local:创建 local.symlinks.toml'
    'completions:生成补全脚本'
    'migrate:迁移配置'
  )

  if (( CURRENT == 2 )); then
    _describe 'subcommand' subcommands
    return
  fi

  case "$words[2]" in
    module)
      _describe 'module commands' 'list:create'
      ;;
    link)
      _describe 'link commands' 'list:add:remove:update'
      ;;
    exec)
      _describe 'exec commands' 'plan:apply:doctor:fix'
      ;;
    local)
      _describe 'local commands' ''
      ;;
    completions)
      _describe 'shell' 'bash:zsh:fish'
      ;;
    migrate)
      _describe 'migrate commands' 'import'
      ;;
  esac
}

_dotlink "$@"
`;
}

function fishScript() {
  return `# dotlink fish completion
complete -c dotlink -f -n '__fish_use_subcommand' -a 'module' -d '模块操作'
complete -c dotlink -f -n '__fish_use_subcommand' -a 'link' -d '链接操作'
complete -c dotlink -f -n '__fish_use_subcommand' -a 'exec' -d '执行与检查'
complete -c dotlink -f -n '__fish_use_subcommand' -a 'local' -d '创建 local.symlinks.toml'
complete -c dotlink -f -n '__fish_use_subcommand' -a 'completions' -d '生成补全脚本'
complete -c dotlink -f -n '__fish_use_subcommand' -a 'migrate' -d '迁移配置'

complete -c dotlink -f -n '__fish_seen_subcommand_from module' -a 'list create'
complete -c dotlink -f -n '__fish_seen_subcommand_from link' -a 'list add remove update'
complete -c dotlink -f -n '__fish_seen_subcommand_from exec' -a 'plan apply doctor fix'
complete -c dotlink -f -n '__fish_seen_subcommand_from completions' -a 'bash zsh fish'
complete -c dotlink -f -n '__fish_seen_subcommand_from migrate' -a 'import'
`;
}

export function renderCompletion(shell) {
  if (shell === 'bash') return bashScript();
  if (shell === 'zsh') return zshScript();
  if (shell === 'fish') return fishScript();
  throw new Error(`不支持的 shell: ${shell}`);
}
