export function getPathPromptOptions(scope = 'global') {
  if (scope === 'local') {
    return {
      src: {
        message: 'src（项目内相对路径，支持 Tab 补全）',
        allowHome: false,
      },
      dst: {
        message: 'dst（支持 ~/ / 绝对路径，支持 Tab 补全）',
        allowHome: true,
      },
    };
  }

  return {
    src: {
      message: 'src（支持 ~/ / 绝对路径，支持 Tab 补全）',
      allowHome: true,
    },
    dst: {
      message: 'dst（支持 ~/ / 绝对路径，支持 Tab 补全）',
      allowHome: true,
    },
  };
}
