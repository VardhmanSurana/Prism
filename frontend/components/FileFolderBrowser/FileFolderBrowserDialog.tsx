import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFileFolderBrowser, BrowserHeader, BrowserBreadcrumbs, BrowserShortcuts, BrowserSearch, BrowserList, FilePreview } from '.';

export const FileFolderBrowserDialog: React.FC = () => {
  const browser = useFileFolderBrowser();

  if (!browser.options) return null;

  const { directoryOnly = false, multiple = false, title } = browser.options;
  const homePath = browser.homePath;

  const shortcutList = [];
  if (homePath) {
    shortcutList.push({ name: 'Home', path: homePath });
    shortcutList.push({ name: 'Pictures', path: `${homePath}/Pictures` });
    shortcutList.push({ name: 'Downloads', path: `${homePath}/Downloads` });
  }
  shortcutList.push({ name: 'External Drive', path: '/run/media/chotaxdon/New Volume' });

  const handleShortcutClick = (path: string) => {
    browser.navigateTo(path);
  };

  const handleHome = () => {
    browser.navigateTo('');
  };

  const handleRetry = () => {
    handleHome();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={browser.cancel}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal Panel */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          className={`relative w-full bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[520px] select-none transition-all duration-300
            ${browser.previewFile ? 'max-w-4xl' : 'max-w-xl'}`}
        >
          <BrowserHeader
            title={title || ((directoryOnly ?? false) ? 'Browse for folder' : 'Browse image files')}
            onClose={browser.cancel}
          />

          <BrowserBreadcrumbs
            currentPath={browser.currentPath}
            onNavigate={(path: string) => browser.fetchDirectory(path, browser.showHidden)}
            onHome={handleHome}
          />

          <div className="p-3 border-b border-white/5 space-y-2 shrink-0 bg-[#0c0c0c]">
            <BrowserShortcuts shortcuts={shortcutList} onShortcutClick={handleShortcutClick} />

            <BrowserSearch
              value={browser.searchQuery}
              onChange={browser.navigateTo}
              placeholder={(directoryOnly ?? false) ? "Filter folders in current view..." : "Filter folders and images..."}
            />
          </div>

          <div className="flex-1 flex overflow-hidden bg-[#050505]">
            <div className="flex-1 min-w-0 overflow-y-auto p-3 custom-scrollbar">
              <BrowserList
                folders={browser.folders}
                files={browser.files}
                isLoading={browser.isLoading}
                error={browser.error}
                isRoot={browser.isRoot}
                parentPath={browser.parentPath}
                selectedPaths={browser.selectedPaths}
                previewFile={browser.previewFile}
                directoryOnly={directoryOnly}
                multiple={multiple}
                searchQuery={browser.searchQuery}
                onGoUp={browser.navigateUp}
                onFolderDoubleClick={browser.handleFolderDoubleClick}
                onItemSelect={(path: string, isFolder: boolean, fileObj?: any) => {
                  browser.handleItemSelect(path, isFolder, fileObj, {
                    directoryOnly,
                    multiple,
                  });
                }}
                onRetry={handleRetry}
              />
            </div>

            {browser.previewFile && (
              <FilePreview
                file={browser.previewFile}
                imgLoading={browser.imgLoading}
                dimensions={browser.dimensions}
                onLoad={(width: number, height: number) => browser.setDimensions({ width, height })}
                onClose={() => {}}
              />
            )}
          </div>



          <div className="p-4 border-t border-white/5 flex items-center justify-between bg-[#080808] shrink-0 select-none">
            <label className="flex items-center gap-2 text-[10px] font-mono uppercase text-white/40 hover:text-white/70 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={browser.showHidden}
                onChange={browser.toggleHidden}
                className="rounded border-white/10 bg-transparent text-primary focus:ring-0 w-3 h-3"
              />
              <span>Show hidden</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                onClick={browser.cancel}
                className="px-4 py-1.5 border border-white/10 hover:border-white/20 hover:bg-white/5 text-white/70 hover:text-white rounded-xl text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={browser.confirm}
                disabled={browser.isLoading}
                className="px-4 py-1.5 bg-primary text-black hover:bg-primary/95 rounded-xl text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {directoryOnly
                  ? (browser.selectedPaths.size > 0 ? 'Use selected folder' : 'Use this folder')
                  : (browser.selectedPaths.size > 0 ? `Use selected (${browser.selectedPaths.size})` : 'Use current')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};