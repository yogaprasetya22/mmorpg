# 🏔️ Dokumentasi Fitur Terrain Editor - Jagres Map Studio

Fitur **Terrain Editor** adalah salah satu modul inti di dalam **Jagres Map Studio** yang memungkinkan Level Designer untuk memahat kontur tanah (deformasi ketinggian) serta mewarnai permukaan tanah (menggunakan warna solid maupun tekstur material).

Modul ini terbagi menjadi dua sub-tab utama:
1. **Height Sculpt** (Pemahatan Ketinggian)
2. **Paint Splat** (Pewarnaan/Pencatan Tekstur)

---

## 🏔️ 1. Height Sculpt (Pemahatan Ketinggian)

Sub-tab **Height Sculpt** digunakan untuk memanipulasi tinggi rendahnya permukaan 3D terrain secara dinamis menggunakan kuas (brush) atau generator prosedural.

### A. Sculpting Tools (Pahat Pilihan)
Terdapat 4 jenis pahat deformasi yang dapat dipilih secara bergantian:
*   **Raise Hills** (Meninggikan Bukit): Menarik tanah ke atas untuk membuat gunung atau bukit.
*   **Lower Valleys** (Menurunkan Lembah): Menekan tanah ke bawah untuk membuat lembah, jurang, atau dasar sungai/danau.
*   **Smooth Slope** (Menghaluskan Lereng): Meratakan transisi kasar antar verteks untuk menghasilkan lereng yang mulus.
*   **Flatten Plain** (Meratakan Dataran): Meratakan ketinggian tanah ke satu nilai target tertentu.
    *   **Flatten Target Height**: Menentukan target ketinggian (dalam meter).
    *   **Sample Button**: Klik tombol ini saat cursor berada di atas terrain untuk langsung mengambil sampel tinggi di posisi cursor tersebut.

> [!TIP]
> **Pintasan Cepat (Shortcut):**
> Sambil melakukan drag klik kiri pada terrain, tekan dan tahan tombol **`Shift`** untuk membalik arah pahat secara instan (contoh: dari *Raise* menjadi *Lower*, dan sebaliknya).

### B. Brush Stroke Configuration (Konfigurasi Kuas)
Setiap pahat menyimpan memorinya sendiri untuk ukuran, kekuatan, dan bentuk kuas yang digunakan.

*   **Brush Mask (Bentuk Kuas):**
    Terdapat 7 pilihan pola sapuan kuas yang bisa diakses cepat via tombol angka `1` hingga `7` pada keyboard:
    1.  `softCircle` (Soft Circle Falloff) - Sapuan melingkar dengan gradasi halus di tepinya.
    2.  `hardCircle` (Sharp Edge Brush) - Sapuan melingkar tegas tanpa gradasi tepi.
    3.  `star` (Star Brush) - Sapuan bermotif bintang.
    4.  `hexagon` (Hex Column Brush) - Sapuan berbentuk segi enam untuk pilar/kolom basalt.
    5.  `starOutline` (Splat Ring Brush) - Sapuan berbentuk cincin/lingkaran berlubang di tengah.
    6.  `square` (Block Box Brush) - Sapuan berbentuk kotak untuk struktur voxel-like.
    7.  `triangle` (Triangle Brush) - Sapuan berbentuk segitiga.
*   **Brush Size (Ukuran Kuas):** Mengatur radius area kuas mulai dari **1m** hingga **150m**.
*   **Brush Intensity (Intensitas Kuas):** Mengatur kekuatan deformasi tanah dari **1%** hingga **100%** per sapuan.

---

### C. Procedural Generators (Pembangkit Prosedural)
Jika Anda ingin membuat peta dasar secara cepat tanpa memahat manual dari nol, Anda dapat memanfaatkan pembangkitan berbasis algoritma Noise dengan parameter berikut:

#### **Preset Cepat:**
*   **Plains (Dataran Rendah)**: Ketinggian `4m`, skala `0.01`, seed `12`.
*   **Hills (Perbukitan)**: Ketinggian `18m`, skala `0.05`, seed `42`.
*   **Peaks (Pegunungan Tinggi)**: Ketinggian `50m`, skala `0.12`, seed `250`.
*   **Crater (Kawah/Lembah)**: Ketinggian `32m`, skala `0.03`, seed `99`.

#### **Parameter Kustom Sliders:**
*   **Max Sculpt Limit (Batas Tinggi):** Batas aman ketinggian maksimum terrain (rentang **30m** s.d. **300m**).
*   **Peak Heights:** Tinggi puncak maksimum dari gelombang noise (rentang **0m** s.d. **100m**).
*   **Terrain Scale:** Frekuensi gelombang noise. Nilai lebih tinggi membuat bukit lebih rapat dan curam (rentang **0.01** s.d. **2.00**).
*   **Noise World Seed:** Nilai seed acak untuk variasi bentuk lanskap (rentang **0** s.d. **1000**).
*   **Peak Sharpness:** Ketajaman puncak gunung (rentang **1.0** s.d. **4.0**).

---

### D. Global Action
*   **Flatten All Heights:** Menghapus seluruh pahatan ketinggian pada peta dan mengembalikannya ke posisi datar semula (0m).

---

## 🎨 2. Paint Splat (Pencatan Tekstur/Warna)

Sub-tab **Paint Splat** digunakan untuk menggambar warna solid atau mencampurkan berbagai tekstur material di atas permukaan terrain.

### A. Paint Blueprint Library (Penyimpanan Preset)
Anda dapat menyimpan kombinasi kuas, warna, dan material favorit Anda ke dalam pustaka Blueprint agar bisa digunakan kembali nanti:
*   **Membuat Preset Baru**: Ketik nama preset di bagian bawah panel lalu klik **`+ Save`**.
*   **Menggunakan Preset**: Klik salah satu kartu preset di dalam daftar.
*   **Menghapus Preset**: Klik ikon sampah (**`Trash`**) di sebelah kanan kartu preset saat mengarahkan pointer ke preset tersebut.

### B. Splat Layer Editor (4 Layer Aktif)
Terrain mendukung pencampuran hingga **4 layer berbeda** (Layer 0, 1, 2, dan 3) secara bersamaan. Setiap layer dapat dikonfigurasi secara mandiri dalam salah satu dari dua mode:

1.  **Solid Color Mode (Mode Warna):**
    Menggunakan warna datar solid. Anda bisa memilih dari warna cepat yang disediakan (hijau rumput, cokelat tanah, abu-abu batu, putih salju, dll.) atau menggunakan **Custom Hex Color Picker** untuk memilih warna apa saja secara bebas.
2.  **Texture Splat Mode (Mode Tekstur):**
    Menggunakan tekstur realistis 3D dari material library. Pilihan material bawaan yang tersedia meliputi:
    *   *Grass* (Rumput hijau subur)
    *   *Stone* (Batu jalanan setapak)
    *   *Sand* (Pasir pantai/gurun)
    *   *Rock* (Batu tebing kasar)
    *   *Snow* (Salju dingin)

### C. Global Action
*   **Reset Splat Canvas:** Menghapus seluruh cat warna dan material di permukaan peta, mengembalikannya ke kondisi bersih semula.

---

## ⌨️ Pintasan Keyboard Terkait Terrain

| Pintasan Keyboard | Konteks | Deskripsi |
| :--- | :--- | :--- |
| **`Shift + Drag`** | Pahat Ketinggian | Membalikkan efek pahat (Meninggikan $\leftrightarrow$ Menurunkan) |
| **`1` s.d. `7`** | Kuas Pahat / Cat | Memilih pola kuas (softCircle, hardCircle, star, dst.) |
| **`[`** / **`]`** | Kuas Pahat / Cat | Memperkecil / memperbesar ukuran kuas (Size) |
| **`-`** / **`+`** | Kuas Pahat / Cat | Mengurangi / menambah kekuatan kuas (Intensity) |
