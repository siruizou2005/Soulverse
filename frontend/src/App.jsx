import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import UniverseView from './components/UniverseView';
import { api } from './services/api';

function App() {
  const [view, setView] = useState('landing'); // landing, login, universe
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查是否已登录
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const result = await api.getCurrentUser();
      if (result.success && result.user) {
        setUser(result.user);
        setView('universe');
      } else {
        // 未登录，显示着陆页
        setView('landing');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      // 出错时也显示着陆页，不阻塞用户
      setView('landing');
    } finally {
      setLoading(false);
    }
  };

  const handleEnter = () => {
    setView('login');
  };

  const handleLoginSuccess = (loginResult) => {
    setUser(loginResult);
    setView('universe');
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  return (
    <>
      {view === 'landing' && <LandingPage onEnter={handleEnter} />}
      {view === 'login' && <LoginPage onLoginSuccess={handleLoginSuccess} />}
      {view === 'universe' && user && <UniverseView user={user} />}
      {view === 'universe' && !user && (
        <div className="w-full h-screen bg-black flex items-center justify-center text-white">
          <div className="text-slate-400">请先登录</div>
        </div>
      )}
      {!view && <LandingPage onEnter={handleEnter} />}
    </>
  );
}

export default App;

