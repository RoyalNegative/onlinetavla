# 🎲 Tavla — online oyun merkezi, basit, ücretsiz

Arkadaşınla URL üzerinden oynanan online oyun merkezi: **tavla, dama, amiral
battı, mangala ve 4'ü bağla**. Oda kur, linki paylaş, hemen başla. Üyelik
**opsiyonel** — istersen Google ile giriş yapıp istatistik, Elo puanı ve
sıralama kazanırsın; istemezsen takma adla oynarsın. Altyapı, ileride başka
oyunların (okey, satranç…) eklenebileceği şekilde **oyundan bağımsız** kuruldu.

🌐 **Canlı:** <https://onlinetavla-asaby.com>

## Özellikler

- **Beş oyun: Tavla, Dama, Amiral Battı, Mangala ve 4'ü Bağla** — aynı
  lobi/oda/sohbet altyapısını paylaşan, oyundan bağımsız `GameModule` mimarisi.
  Yenisini eklemek = bir modül yazmak. Amiral Battı'da gizli bilgi (rakip
  filosu) sunucuda kalır — hile yok.
- **Gerçek-zamanlı, otoriter sunucu** — zarları sunucu atar, her hamleyi
  doğrular → hile yok. Siyah oyuncu için tahta otomatik çevrilir.
- **URL ile oda** veya **🎯 online matchmaking** (rastgele rakip bul).
- **Pratik modu** (`/pratik`) — bota karşı, sunucusuz, yeni öğrenenler için.
- **Klasik / çift zarlı (cube)**, **maç modu** (ilk N; mars ×2, backgammon ×3).
- **Sohbet + emoji**, **rövanş**, **yeniden bağlanma**, **izleyici**, taş kayma
  ve zar animasyonu, ses efektleri, "sıra sende" bildirimi, mobil uyumlu.
- **Opsiyonel hesap** (Firebase): kalıcı profil + handle, Elo, toplam mars,
  kazanma %, seri, **sıralama**, **maç geçmişi**, **arkadaş listesi** (online
  durumu + oyuna çağırma) ve **günlük turnuva** — hepsi sunucuda tutulur,
  sahtelenemez. Hesap olmadan da her şey takma adla çalışır.

## Teknolojiler & barındırma

| Katman | Ne kullandık | Neden |
| --- | --- | --- |
| Dil | **TypeScript** (uçtan uca) | Tek dil; tipler ve oyun kuralları paylaşılır |
| Monorepo | **npm workspaces** | engine / server / web tek repoda |
| Oyun motoru | Saf TS (bağımlılıksız) + **Vitest** | Test edilebilir, otoriter kurallar |
| Sunucu | **Node + Express + Socket.IO** | Gerçek-zamanlı; zarı atan/hamleyi doğrulayan otorite |
| İstemci | **React + Vite + Tailwind + Zustand** | SVG tahta, zar animasyonu, hızlı build |
| Hesap (opsiyonel) | **Firebase** Auth + Firestore (Admin SDK) | İsteğe bağlı giriş; sahtelenemez istatistik/sıralama |
| Barındırma | **Render** — ücretsiz, kalıcı Node servisi (`render.yaml`) | WebSocket + bellekte oda durumu gerektirir |

**Neden Render, Vercel değil?** Oyun sunucusu sürekli açık **WebSocket** bağlantıları
ve **bellekte paylaşılan oda durumu** tutar; bu yüzden **hep-açık (kalıcı) bir Node
süreci** gerekir. Vercel/Netlify gibi serverless platformlar her isteği kısa ömürlü,
durumsuz bir fonksiyonla karşıladığından bu mimariyi barındıramaz (fonksiyon çöker).
Render/Railway/Fly ise kalıcı bir süreç çalıştırır — gerçek-zamanlı çok-oyunculu için
gereken budur. Tek servis hem oyunu (websocket) hem de derlenmiş arayüzü servis eder
→ tek URL.

## Hızlı başlangıç (geliştirme)

```bash
npm install
npm run dev
```

- Web: <http://localhost:5173>
- Sunucu: <http://localhost:8787> (web, API ve websocket'i Vite proxy'ler)

İki sekme aç, birinde oda kur, çıkan linki diğer sekmede aç — kendi kendine oyna.

## Üretim (tek servis, tek URL)

```bash
npm run build      # web istemcisini packages/web/dist'e derler
npm start          # sunucu hem oyunu hem statik istemciyi servis eder (:8787)
```

Tek bir Node servisi yeterli. **Render / Railway / Fly** gibi ücretsiz katmanlarda:

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Port: `PORT` env'inden okunur.

> ⚠️ **Vercel / Netlify (serverless) bu sunucuyu barındıramaz.** Oyun sunucusu
> kalıcı bir WebSocket (Socket.IO) servisidir; serverless fonksiyonlar kısa
> ömürlü ve durumsuz olduğundan çöker. Kalıcı Node süreci olan bir platform
> kullan.

Eski bir Vercel denemesi `onlinetavla.vercel.app` adresinde duruyordu ve tam da
bu yüzden `FUNCTION_INVOCATION_FAILED` ("This Serverless Function has crashed")
veriyordu. Repodaki `vercel.json` artık o adrese gelen her isteği kalıcı (308)
olarak `onlinetavla-asaby.com`'a yönlendirir — build çalıştırmaz, sadece
`vercel-redirect/` klasörünü yayınlar. Render tarafını etkilemez.

**Render ile tek tık:** repoda `render.yaml` var. Render → **New + → Blueprint**
→ bu repoyu seç → deploy. (Ücretsiz katman bir süre sonra uykuya geçer; ilk
istekte ~50 sn soğuk başlatma olur.)

**Uyanık tutma (ücretsiz):** soğuk başlatma hem kullanıcıyı hem Googlebot'u
vurur. Repoda `.github/workflows/keep-alive.yml` her 10 dakikada `/health`'e
ping atıp servisi uyandırır. Daha güvenilir 5 dakikalık ping için ücretsiz bir
**UptimeRobot** (veya cron-job.org) monitörü kur: tür `HTTP(s)`, URL
`https://onlinetavla-asaby.com/health`, aralık `5 min`.

### SEO

`packages/web/index.html` başlık/description, Open Graph + Twitter kartları ve
JSON-LD (`WebApplication`/`VideoGame` + `FAQPage`) içerir; `#root` içine ham
HTML'de taranabilir bir landing metni gömülüdür (React yüklenince değişir).
`packages/web/public/` altında `robots.txt`, `sitemap.xml` ve sosyal görsel
(`og-image.svg`) vardır. Deploy sonrası siteyi **Google Search Console**'a
**URL öneki** mülkü olarak ekle ve `sitemap.xml`'i gönder.

## Firebase (opsiyonel — hesaplar için)

Hesap özellikleri olmadan da her şey çalışır. Açmak istersen:

1. Firebase Console'da bir proje + **Authentication → Google** sağlayıcısını aç,
   **Firestore**'u (production mode) oluştur.
2. **Web istemci:** `packages/web/.env.example` → `.env` yap, web app config
   anahtarlarını gir.
3. **Sunucu:** `packages/server/.env.example` → `.env`. Servis hesabı JSON'unu
   `FIREBASE_SERVICE_ACCOUNT` olarak yapıştır (veya
   `GOOGLE_APPLICATION_CREDENTIALS` ile dosya yolu ver).

Sunucu, maç bitince giriş yapmış oyuncuların sonucunu Firestore'a yazar
(`users/{uid}` istatistikler + Elo, `users/{uid}/matches` geçmiş). Tüm Firestore
erişimi sunucu (Admin SDK) üzerinden olduğu için istemci-tarafı güvenlik kuralı
yazmana gerek yok.

## Proje yapısı

```
packages/
  engine/   Saf TS tavla motoru — kurallar, hamle üretimi, kazanma, cube, maç skoru.
            Bağımlılığı yok, %100 birim-testli. Platform soyutlaması: GameModule.
  server/   Express + Socket.IO. Oyundan bağımsız oda yöneticisi, otoriter durum,
            sohbet, rövanş, yeniden bağlanma + opsiyonel Firebase hesap katmanı.
  web/      React + Vite + Tailwind + Zustand. SVG tahta, zar animasyonu,
            tıkla-oyna, sohbet, sıralama/profil.
```

## Test

```bash
npm test          # engine birim testleri (Vitest)
npm run typecheck # üç paketi de tsc ile denetler
```

## İleride yeni oyun eklemek

`packages/engine/src/module.ts` içindeki `GameModule` arayüzünü uygula
(`createInitialState`, `applyAction`, `isOver`, `viewFor`) ve sunucuya kaydet.
Oda yöneticisi, sohbet, yeniden bağlanma ve hesap katmanı **hiç değişmeden**
yeni oyunla çalışır.

Arayüz tarafında üç şey gerekir:

1. `web/src/lib/games.ts` → `GAME_META`'ya başlık, alt başlık ve vurgu rengi
   (`tint`). Bu üçlü hem ana ekran kataloğunda hem oda başlığında hem de
   tahtanın arka plan ışığında kullanılır.
2. `web/src/components/GameGlyph.tsx` → `MARKS` içine oyunun işareti. Emoji
   kullanma: işaretler 24'lük ızgarada, 1.5 kalınlıkta tek çizgi ve tek dolu
   öğe (oyunun kendi `tint`'i) kuralına uyar.
3. `web/src/screens/Home.tsx` → `GAMES` dizisine `kind` (`duel` / `party`),
   bir cümlelik `desc` ve `how` metni.

---

MIT-benzeri kişisel proje. İyi oyunlar! 🎲
