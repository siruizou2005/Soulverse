import { useState } from 'react';
import { User } from 'lucide-react';
import { motion } from 'framer-motion';
import CosmicBackground from './CosmicBackground';
import { api } from '../services/api';

export default function LoginPage({ onLoginSuccess }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.login(userId, password, false);
      if (result.success) {
        onLoginSuccess(result);
      } else {
        alert('登录失败: ' + (result.message || '未知错误'));
        setLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('登录失败: ' + error.message);
      setLoading(false);
    }
  };

  const handleGuestMode = async () => {
    setLoading(true);
    try {
      const result = await api.login('', '', true);
      if (result.success) {
        onLoginSuccess(result);
      } else {
        alert('访客模式失败: ' + (result.message || '未知错误'));
        setLoading(false);
      }
    } catch (error) {
      console.error('Guest mode error:', error);
      alert('访客模式失败: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="relative w-full h-screen bg-black flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
    >
      <CosmicBackground intensity={1.5} />

      <motion.div
        className="z-10 w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-700 p-8 rounded-2xl shadow-2xl"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-cyan-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5)]">
            <User className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white">身份识别</h2>
          <p className="text-slate-400 mt-2">连接到神经接口</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="group">
            <label className="block text-slate-500 text-sm mb-1 group-focus-within:text-cyan-400 transition-colors">
              通信ID / 邮箱
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 outline-none transition-all"
            />
          </div>
          <div className="group">
            <label className="block text-slate-500 text-sm mb-1 group-focus-within:text-cyan-400 transition-colors">
              访问密钥 / 密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-lg mt-6 transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50"
          >
            {loading ? '初始化中...' : '初始化链接'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-slate-500 text-sm">访客模式? </span>
          <button
            onClick={handleGuestMode}
            disabled={loading}
            className="text-cyan-400 text-sm hover:underline disabled:opacity-50"
          >
            立即漫游
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

