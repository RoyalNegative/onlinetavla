# Google Ads — OnlineTavla kampanya rehberi

Türkiye hedefli, **2000 TL/ay** bütçeli arama (Search) kampanyası. Aşağıdakileri
Google Ads arayüzüne olduğu gibi kopyala-yapıştır kullanabilirsin.

---

## 0. Başvuru / kurulum süreci (sıfırdan)

İş başvurusu gibi bir onay yok — kaydol, kartı ekle, kampanyayı kur. Reklamlar
yayına girmeden Google'ın **otomatik incelemesinden** geçer (~birkaç saat, en geç
1 iş günü).

1. <https://ads.google.com> → **Şimdi başlayın** → mevcut Google hesabınla gir.
2. İlk ekran seni "akıllı/basit" kuruluma sokmaya çalışır. **Alttaki
   "Uzman moduna geç" (Switch to Expert Mode)** bağlantısına tıkla — tüm
   ayarların kontrolü için bu şart.
3. "Hedef seçmeden kampanya oluştur" de (bir hedefe kilitlenme).
4. **Faturalandırma:** Araçlar (🔧) → Faturalandırma → ödeme yöntemi ekle.
   İstersen **ön ödeme** (manuel): 2000 TL yükle, bitince reklamlar durur —
   bütçe aşımı riski olmaz.

---

## 1. Kampanya ayarları

Yeni Kampanya → tür **Arama (Search)** → şu ayarlar:

| Ayar | Değer |
|---|---|
| Kampanya türü | **Arama** (yalnız bu; Display/PMax'e başlama) |
| Konum | **Türkiye** — "Konum seçenekleri"nde **"Bulunduğu yer: hedef konumdaki kişiler"** seç (varsayılan "ilgi duyan" değil) |
| Dil | Türkçe |
| Günlük bütçe | **65 TL** (2000 TL/ay ≈ 65 TL/gün) |
| Teklif stratejisi | Başlangıç: **Tıklama Sayısını En Üst Düzeye Çıkar**, maksimum TBM sınırı **1,50 TL**. ~30 dönüşüm birikince → **Dönüşümleri En Üst Düzeye Çıkar** |
| Ağlar | "Arama ortakları" ve "Display Ağı'na genişlet" → **KAPALI** |
| Reklam dönüşümü | Başta serbest bırak (Google optimize etsin) |

---

## 2. Reklam grupları + anahtar kelimeler

Grupları dar tut → yüksek Kalite Puanı → düşük tıklama maliyeti. Anahtar
kelimeleri şu biçimde gir: `"..."` = öbek eşleme, `[...]` = sıkı eşleme.

### Grup 1 — Online Tavla Oyna  → açılış: `/`
```
"online tavla"
"online tavla oyna"
"tavla oyna"
"canlı tavla"
[online tavla]
[tavla oyna]
```

### Grup 2 — Arkadaşınla Tavla  → açılış: `/`
```
"arkadaşınla tavla"
"arkadaşla tavla oyna"
"iki kişilik tavla"
"link ile tavla"
```

### Grup 3 — Ücretsiz / Üyeliksiz Tavla  → açılış: `/`
```
"ücretsiz tavla"
"bedava tavla oyna"
"üyeliksiz tavla"
"kayıt olmadan tavla"
[ücretsiz tavla]
```

### Grup 4 — Tavla Nasıl Oynanır (bilgi niyeti, ucuz)  → açılış: `/nasil-oynanir`
```
"tavla nasıl oynanır"
"tavla kuralları"
"tavla öğren"
```

---

## 3. Responsive Search Ad (RSA) metinleri

Her grupta bir RSA oluştur. Başlıkları (≤30 karakter) ve açıklamaları (≤90) gir;
Google en iyi kombinasyonu kendi test eder.

**Başlıklar (15'e kadar):**
```
Online Tavla Oyna
Ücretsiz Online Tavla
Arkadaşınla Tavla Oyna
Üyeliksiz, Reklamsız Tavla
Oda Kur, Linki Paylaş
Saniyeler İçinde Başla
Tarayıcıda Tavla, İndirme Yok
Klasik & Çift Zarlı Tavla
Hemen Rakip Bul
Bedava Tavla, Kayıt Yok
Canlı Online Tavla
Mobil Uyumlu, Hızlı Tavla
```

**Açıklamalar (4):**
```
Oda kur, linki gönder, hemen tavla oyna. Ücretsiz, reklamsız, üyelik yok.
Klasik ve çift zarlı tavla, online rakip bulma, bota karşı pratik.
Arkadaşınla ya da rastgele rakiple ücretsiz tavla. Tarayıcıda, indirme yok.
Türkiye'nin en hızlı online tavla deneyimi. Kayıt olmadan hemen başla.
```

> **Grup 4** için 1. başlığı `Tavla Nasıl Oynanır?` yap, bir açıklamayı
> `Kuralları öğren, sonra ücretsiz online oyna.` ile değiştir.

---

## 4. Negatif anahtar kelimeler (kampanya seviyesi)

Boşa tıklama önler. Kampanya → Anahtar Kelimeler → Negatif → ekle:
```
indir, apk, uygulama indir, hile, hileli, mod
bahis, iddaa, kumar, casino, gerçek para, para kazanma
ahşap tavla, tavla takımı, mağaza, satın al, fiyat
okey, batak, satranç, pişti, pdf, kitap, ücretli
```

---

## 5. Reklam öğeleri (uzantılar) — CTR'yi artırır, mutlaka ekle

Kampanya → **Öğeler (Assets)**:

- **Site bağlantıları:**
  - `Nasıl Oynanır` → `/nasil-oynanir`
  - `Bota Karşı Pratik` → `/pratik`
  - `Rakip Bul` → `/`
  - `Dama Oyna` → `/`
- **Ek açıklamalar:** `Ücretsiz` · `Üyelik Yok` · `Reklamsız` · `Anında Başla` · `Mobil Uyumlu`
- **Yapılandırılmış snippet:** Tür = *Oyun türleri* → `Klasik tavla`, `Çift zarlı`, `Dama`, `Bota karşı pratik`

---

## 6. Dönüşüm ölçümü (bunu kurmadan reklam "kör" çalışır)

Kod tarafı hazır: `packages/web/src/lib/analytics.ts` `room_created` ve
`match_search` olaylarını tetikliyor. Bağlamak için:

1. **GA4** hesabı aç → ölçüm ID'sini al (`G-XXXXXXX`).
2. Render → servis → **Environment** → `VITE_GA_MEASUREMENT_ID=G-XXXXXXX` ekle →
   deploy sonrası analitik otomatik aktifleşir (id yoksa tamamen kapalı/no-op).
3. GA4 → **Yönetici → Etkinlikler** → `room_created` → **"Anahtar etkinlik"
   (dönüşüm)** işaretle.
4. Google Ads → **Araçlar → Bağlı hesaplar → Google Analytics (GA4)** → bağla →
   `room_created` dönüşümünü **içe aktar**.

Artık Ads "kaç tıklama oda kurulmasına yol açtı"yı görür ve bütçeyi buna göre
optimize eder. (Alternatif: `VITE_ADS_CONVERSION_ID=AW-...` ile doğrudan Ads
etiketi de desteklenir.)

---

## 7. İlk 2 hafta — ne izlemeli

- **Arama Terimleri raporu** (Anahtar Kelimeler → Arama terimleri): alakasız
  terimleri gördükçe negatif ekle. En önemli optimizasyon budur.
- **Kalite Puanı** düşük (< 5) anahtar kelimeleri gözden geçir — açılış sayfası +
  reklam metni uyumunu artır.
- İlk günlerde tıklama pahalıysa panik yapma; Google öğrenirken CPC düşer.
- ~30 dönüşüm birikince teklif stratejisini **Dönüşümleri En Üst Düzeye Çıkar**'a
  çevir.

---

## Hızlı özet

Türkiye · 65 TL/gün · Arama · 4 dar reklam grubu · öbek+sıkı eşleme · güçlü
negatif liste · uzantılar · GA4 üzerinden `room_created` dönüşümü. Metinler ve
anahtar kelimeler yukarıda kopyala-yapıştır hazır.
