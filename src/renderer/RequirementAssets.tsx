import { FileArchive, UploadCloud, X } from "lucide-react";
import type { FileAsset, StudioAPI } from "../shared/contracts";
import { isImageAttachment } from "./AttachmentImages";
import { I18nT } from "./i18n";

export default function RequirementAssets({
  assets,
  api,
  upload,
  remove,
  report,
}: {
  assets: FileAsset[];
  api?: StudioAPI;
  upload: (files?: FileList) => void;
  remove: (id: string) => void;
  report: (message: string, error?: boolean) => void;
}) {
  return (
    <>
      <div
        className="dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          upload(event.dataTransfer.files);
        }}
      >
        <UploadCloud size={24} />
        <strong>
          {I18nT(
            "需求文档与设计图片（可选）",
            "Requirement documents and design images (optional)",
          )}
        </strong>
        <p>
          {I18nT(
            "拖入 ZIP，或多选 Markdown、TXT、PNG、JPG 等文件；不需要 HTML 原型。文档说明业务规则，设计图作为视觉参考。",
            "Drop a ZIP, or select Markdown, TXT, PNG, JPG and related images. No HTML prototype is required. Documents define behavior; images provide visual references.",
          )}
        </p>
        <button type="button" disabled={!api} onClick={() => upload()}>
          <FileArchive size={15} />
          {I18nT("选择需求资料", "Choose requirement files")}
        </button>
      </div>
      {assets
        .filter(
          (asset) => asset.kind === "attachment" && !isImageAttachment(asset),
        )
        .map((asset) => (
          <div className="asset-card" key={asset.id}>
            <div className="asset-heading">
              <FileArchive size={19} />
              <div>
                <strong>{asset.name}</strong>
                <small>
                  {asset.documents?.length ?? 0} {I18nT("份文档", "documents")}{" "}
                  · {asset.images?.length ?? 0}{" "}
                  {I18nT("张设计图", "design images")}
                </small>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={I18nT("移除资料：", "Remove source: ") + asset.name}
                onClick={() => remove(asset.id)}
              >
                <X size={16} />
              </button>
            </div>
            <details>
              <summary>
                {I18nT(
                  "查看资料清单与预览",
                  "Inspect and preview source files",
                )}
              </summary>
              <ul className="file-list">
                {(asset.entries ?? []).slice(0, 60).map((entry) => (
                  <li key={entry}>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        void api
                          ?.previewAsset(asset.id, entry)
                          .catch((error) => report(error.message, true))
                      }
                    >
                      {entry}
                    </button>
                  </li>
                ))}
              </ul>
              {(asset.entries?.length ?? 0) > 60 && (
                <small>
                  {I18nT(
                    "此处仅展示前 60 个文件；评估时可读取完整资料目录。",
                    "Only the first 60 files are shown here; assessment can inspect the full source directory.",
                  )}
                </small>
              )}
            </details>
          </div>
        ))}
    </>
  );
}
