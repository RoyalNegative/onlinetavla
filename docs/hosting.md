# Hosting: 30 sn'lik cold start'tan kurtulmak

Sorun: Render **free** planında servis 15 dk trafik almayınca uykuya geçiyor;
ilk ziyaretçi 30–60 sn bekliyor. Seçenekler (Temmuz 2026 fiyatları):

## Önerilen: Render Starter — $7/ay (~€6.5)

- Dashboard → servis → **Settings → Instance Type → Starter (512 MB)**.
- Hiçbir kod/deploy değişikliği gerekmez; main'e push → otomatik deploy aynen sürer.
- Uyku tamamen kalkar, cold start biter. Bütçenin (aylık €20) üçte biri.

## Ücretsiz geçici çözüm: uptime ping

- [UptimeRobot](https://uptimerobot.com) (ücretsiz) ile `https://onlinetavla.onrender.com/health`
  adresine 5 dk'da bir HTTP isteği kur.
- Free plan ayda 750 saat instans veriyor — tek servis 7/24 ayakta kalabilir (31 gün ≈ 744 saat).
- Dezavantaj: garanti değil (Render bu kullanımı hedeflemiyor), free instans yavaş
  (0.1 vCPU) ve deploy sonrası ilk istek yine yavaş olabilir.

## Alternatif platformlar (taşınmak istenirse)

| Platform | Fiyat | Not |
|---|---|---|
| Railway | ~$5/ay (kullanım bazlı) | WebSocket sorunsuz, kolay taşınır |
| Fly.io | ~$3–5/ay (küçük VM) | En ucuz ama kurulum/CLI işi daha fazla |
| Koyeb | Free nano / ~$5 | Free katmanı küçük; Socket.IO destekli |

Sunucu tek Node süreci (Express + Socket.IO, `/health` hazır) olduğu için
hepsine kolay taşınır; ama en az sürtünme Render içinde plan yükseltmek.
