// Связывает HTTP-сервер с временным кешем и точечной проверкой публикации через edge. У worker нет SQL-доступа и пользовательских сессий.
import { createVideoCache } from "./cache.mjs";
import { prepareVideo } from "./prepare.mjs";
import { createVideoServer } from "./server.mjs";
import { readPublicYoutubeState, createThumbnailReader } from "./upstream.mjs";

const cache = await createVideoCache({ root: "/cache", prepare: prepareVideo });
const server = createVideoServer({
  cache,
  readPublication: (id, signal) =>
    /* Читает компактное решение API о публикации конкретного ID; worker не становится владельцем собственной копии доступа. */ readPublicYoutubeState("http://edge:8080/api/trpc/videos.publicYoutubeState", id, signal),
  readThumbnail: createThumbnailReader(),
});
server.listen(8082, "0.0.0.0");
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    const closing = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await Promise.all([closing, cache.close()]);
  });
