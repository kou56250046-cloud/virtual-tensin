import LoginForm from '@/components/login/LoginForm';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#c8966e] via-[#b07840] to-[#8B5E3C]
                     flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* 天井パネル模様（装飾） */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute border border-amber-200/60"
               style={{ left: `${i * 17}%`, top: 0, width: '17%', height: '100%' }} />
        ))}
      </div>

      {/* 蝋燭のグロー */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-72 h-72 bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* タイトル */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🕯️</div>
          <h1 className="text-2xl font-bold text-amber-100 tracking-wider mb-1
                         drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            天心苑 祈祷室
          </h1>
          <p className="text-amber-200/70 text-sm">
            バーチャル祈祷会へようこそ
          </p>
        </div>

        {/* ログインカード */}
        <div className="bg-[#3a2010]/70 border border-amber-700/40 rounded-2xl p-6
                        backdrop-blur-sm shadow-2xl shadow-black/40">
          <LoginForm />
        </div>

        <p className="text-center text-amber-200/30 text-xs mt-6">
          天心苑 祈祷会 — 平日 22:00〜25:00
        </p>
      </div>
    </main>
  );
}
