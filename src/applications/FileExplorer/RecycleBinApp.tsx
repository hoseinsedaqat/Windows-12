import type { AppWindowProps } from '../registry';
import { RECYCLE_BIN_ID } from '../../core/FileSystem';
import FileExplorerApp from './FileExplorerApp';

/** Recycle Bin = File Explorer locked to the deleted-items view. */
export function RecycleBinApp(props: AppWindowProps) {
  return <FileExplorerApp windowId={props.windowId} props={{ ...props.props, recycle: true, path: RECYCLE_BIN_ID }} />;
}

export default RecycleBinApp;
