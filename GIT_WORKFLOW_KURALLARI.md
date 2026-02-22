# GIT_WORKFLOW_KURALLARI

Bu dosya, ekip içinde çakışmaları azaltmak ve `main` branch'ini temiz tutmak için zorunlu Git çalışma akışını tanımlar.

## Zorunlu Kurallar

### 1. Her işe başlamadan önce (`main` güncel olmalı)
```bash
git checkout main
git pull origin main
```

## 2. Yeni bir iş yapacaksan branch açmadan devam etme
`main` üzerinde geliştirme yapılmaz.

```bash
git checkout -b isim-ver
```

Örnek branch isimleri:
- `feature-admin`
- `fix-login`
- `ui-profile`
- `feature-risk-panel`
- `fix-api-contract-response`

## 3. Değişikliği yaptıktan sonra commit al
```bash
git add .
git commit -m "Ne yaptığını yaz"
```

Örnek commit mesajları:
- `Admin panel UI düzenlendi`
- `Class sistemi eklendi`
- `Bug fix`
- `Risk hesaplama endpointi eklendi`
- `Parcel panel API entegrasyonu yapıldı`

## 4. Branch'i GitHub'a gönder
```bash
git push -u origin branch-ismi
```

Örnek:
```bash
git push -u origin feature-admin
```

## 5. Pull Request (PR) aç
GitHub'da çıkan **Compare & pull request** butonuna bas.

PR ayarı:
- `base`: `main`
- `compare`: kendi branch'in

## Ek Uyarılar (Önemli)
- `main` branch'ine doğrudan commit/push yapma.
- Başkasının branch'ine commit atma.
- Commit mesajı açıklayıcı olsun ("update" gibi belirsiz mesajlardan kaçın).
- Büyük değişiklikleri tek commit yerine mantıklı parçalara böl.
- PR açmadan önce kendi değişikliğini kısa test et.

## Önerilen Kısa Akış (Özet)
1. `main`'i güncelle
2. Yeni branch aç
3. Değişikliği yap
4. Commit al
5. Push et
6. PR aç (`base=main`)

---

Bu kurallar proje boyunca tüm ekip üyeleri için geçerlidir.
