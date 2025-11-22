// 调试工具：在控制台输出调试信息
if (import.meta.env.DEV) {
  window.debugSoulverse = {
    checkComponents: () => {
      console.log('Checking components...');
      const root = document.getElementById('root');
      console.log('Root element:', root);
      console.log('Root children:', root?.children);
    },
    checkAPI: async () => {
      const { api } = await import('./services/api');
      try {
        const result = await api.getCurrentUser();
        console.log('API getCurrentUser result:', result);
      } catch (error) {
        console.error('API error:', error);
      }
    }
  };
  console.log('Soulverse debug tools loaded. Use window.debugSoulverse to debug.');
}

