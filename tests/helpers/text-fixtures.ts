// Locally constructed encodings; no private or downloaded documents.
// Набор намеренно содержит разные кодировки, BOM, emoji и управляющие символы; нормализация этих литералов разрушила бы проверку детектора.
export const utf8Text = Buffer.from("Привет!\tТекст\r\nСтраница\f🙂");
export const cp1251Text = Buffer.from("cff0e8e2e5f2210d0a", "hex"); // Привет! CR LF
export const utf16leText = Buffer.from("\ufeffПривет!\n🙂", "utf16le");
export const utf16beText = Buffer.from(utf16leText).swap16();
