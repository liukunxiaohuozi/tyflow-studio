import { useEffect, useState } from "react";
import { ImageIcon, X } from "lucide-react";
import type { FileAsset, StudioAPI } from "../shared/contracts";
import { I18nT } from "./i18n";

export const isImageAttachment = (asset: FileAsset) =>
  asset.kind === "attachment" && /\.(png|jpe?g|webp|gif)$/i.test(asset.name);

function ImageCard({
  asset,
  api,
  remove,
  report,
}: {
  asset: FileAsset;
  api?: StudioAPI;
  remove?: (id: string) => void;
  report: (message: string, error?: boolean) => void;
}) {
  const [thumbnail, setThumbnail] = useState("");
  useEffect(() => {
    let live = true;
    if (api)
      void api
        .imageThumbnail(asset.id)
        .then((url) => {
          if (live) setThumbnail(url);
        })
        .catch(() => {
          if (live) setThumbnail("");
        });
    return () => {
      live = false;
    };
  }, [api, asset.id]);
  return (
    <div className="evidence-image">
      <button
        type="button"
        className="evidence-preview"
        disabled={!api}
        aria-label={I18nT("查看截图：", "View screenshot: ") + asset.name}
        onClick={() =>
          void api
            ?.previewAsset(asset.id)
            .catch((error) => report(error.message, true))
        }
      >
        {thumbnail ? (
          <img src={thumbnail} alt={asset.name} />
        ) : (
          <ImageIcon size={24} />
        )}
        <span title={asset.name}>{asset.name}</span>
      </button>
      {remove && (
        <button
          type="button"
          className="icon-button evidence-remove"
          aria-label={I18nT("移除截图：", "Remove screenshot: ") + asset.name}
          onClick={() => remove(asset.id)}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default function AttachmentImages({
  assets,
  api,
  remove,
  report,
}: {
  assets: FileAsset[];
  api?: StudioAPI;
  remove?: (id: string) => void;
  report: (message: string, error?: boolean) => void;
}) {
  const images = assets.filter(isImageAttachment);
  if (!images.length) return null;
  return (
    <div
      className="evidence-images"
      aria-label={I18nT("问题截图", "Issue screenshots")}
    >
      {images.map((asset) => (
        <ImageCard key={asset.id} {...{ asset, api, remove, report }} />
      ))}
    </div>
  );
}
