export default function UnauthorizedPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-400">Yetkisiz Erişim</h1>
        <p className="mt-2 text-slate-400">Bu panele erişim yetkiniz bulunmamaktadır.</p>
        <a href="/login" className="mt-4 inline-block text-blue-400 hover:underline">
          Giriş sayfasına dön
        </a>
      </div>
    </div>
  )
}
