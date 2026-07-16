/**
 * Helpers xử lý URL / ID YouTube.
 *
 * Hỗ trợ mọi dạng URL:
 *   - https://www.youtube.com/watch?v=ID
 *   - https://youtu.be/ID
 *   - https://www.youtube.com/embed/ID
 *   - https://www.youtube.com/shorts/ID
 *   - https://m.youtube.com/watch?v=ID
 *   - https://www.youtube.com/watch?v=ID&t=42s
 *   - https://youtu.be/ID?si=TV4LNn3ATCMZkMNI
 *   - ID thuần (11 ký tự)
 *
 * Nếu URL không nhận diện được → trả về null.
 */

const YT_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/**
 * Trích xuất YouTube video ID từ URL hoặc trả về nguyên chuỗi nếu đã là ID hợp lệ.
 * Trả về null nếu không parse được.
 */
export function extractYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Đã là ID thuần
  if (YT_ID_REGEX.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\/+/, "").split("/")[0];
    return YT_ID_REGEX.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    // /watch?v=ID
    const v = url.searchParams.get("v");
    if (v && YT_ID_REGEX.test(v)) return v;

    // /embed/ID  hoặc  /shorts/ID  hoặc  /live/ID
    const segments = url.pathname.split("/").filter(Boolean);
    const idIdx = segments.findIndex((s) =>
      ["embed", "shorts", "live", "v"].includes(s)
    );
    if (idIdx >= 0 && segments[idIdx + 1] && YT_ID_REGEX.test(segments[idIdx + 1])) {
      return segments[idIdx + 1];
    }
  }

  return null;
}

/**
 * Tạo URL embed từ YouTube ID.
 *
 * Các tham số chống click-out:
 *   - rel=0           : không hiện video gợi ý cuối clip
 *   - modestbranding=1: ẩn logo YouTube lớn ở control bar
 *   - disablekb=1     : tắt hotkeys YouTube (k, f, c, j, l, m, 0-9, space)
 *   - fs=0            : tắt nút fullscreen YouTube
 *   - iv_load_policy=3: không hiện annotations chứa link
 *   - cc_load_policy=0: không tự bật subtitle
 *   - playsinline=1   : không bật fullscreen native trên mobile
 *   - loop=1          : replay liên tục (kết hợp playlist=ID)
 *   - playlist=ID     : bắt buộc cho loop, cũng thay "Up next"
 *   - controls=0      : ẨN control bar hoàn toàn (không tua được)
 *   - enablejsapi=1   : bật IFrame Player API để client hook getCurrentTime
 *
 * Lưu ý: khi controls=0, một số tham số khác (modestbranding, fs) bị YouTube bỏ qua.
 * Đó là trade-off đã chấp nhận: ưu tiên chống tua hơn là branding.
 *
 * Tất cả params đều được encode an toàn cho URL.
 */
export function buildYouTubeEmbedUrl(
  id: string,
  options: { hideControls?: boolean } = {}
): string {
  const { hideControls = false } = options;
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    disablekb: "1",
    fs: hideControls ? "0" : "0",
    iv_load_policy: "3",
    cc_load_policy: "0",
    playsinline: "1",
    loop: "1",
    playlist: id,
    controls: hideControls ? "0" : "1",
    enablejsapi: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}

/**
 * Lấy URL xem YouTube chính thức từ ID.
 */
export function buildYouTubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
