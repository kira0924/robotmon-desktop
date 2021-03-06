import React, { Component } from 'react';
import _ from 'lodash';
import AceEditor from 'react-ace';
import 'brace/mode/javascript';
import 'brace/snippets/javascript';
import 'brace/theme/monokai';
import 'brace/ext/language_tools';
import 'brace/ext/searchbox';
import fs from 'fs';

import { CAppEB, CEditorEB, CServiceControllerEB, CLogsEB } from './modules/event-bus';
import EditorClient from './modules/editor-client';
import ServiceController from './components/ServiceController';
import LogController from './components/LogController';
import ScreenController from './components/ScreenController';
import ScreenCrops from './components/ScreenCrops';

import './styles/global.css';
import menuPhoneIcon from './images/ic_phone.png';
import menuPhotoIcon from './images/ic_photo.png';
// import menuFilesIcon from './images/ic_files.png';

export default class App extends Component {
  constructor(props) {
    super();
    this.props = props;
    this.state = {
      scriptPath: '',
      editorValue: '',
      editorClient: undefined,
      isMenuService: true,
      // isMenuFiles: false,
      isMenuAssets: false,
    };
    this.editorClients = {};
    this.onMenuChange = this.onMenuChange.bind(this);
    this.onEditorChange = this.onEditorChange.bind(this);
    this.onStateChange = this.onStateChange.bind(this);
    this.onFileRead = this.onFileRead.bind(this);
    this.onFileSave = this.onFileSave.bind(this);
    this.onFileRun = this.onFileRun.bind(this);
    this.onStop = this.onStop.bind(this);
    this.runScriptByPath = this.runScriptByPath.bind(this);
    this.runScript = this.runScript.bind(this);
    CEditorEB.addListener(CEditorEB.EventClientChanged, this.onStateChange);
  }

  componentDidMount() {
    CAppEB.addListener(CAppEB.EventNewEditor, (ip) => {
      if (ip !== '') {
        if (_.isUndefined(this.editorClients[ip])) {
          this.editorClients[ip] = new EditorClient(ip);
        }
        this.setState({
          editorClient: this.editorClients[ip],
        });
      }
    });
  }

  onMenuChange(buttonType) {
    let isMenuService = false;
    // let isMenuFiles = false;
    let isMenuAssets = false;

    switch (buttonType) {
      case 'service':
        isMenuService = true;
        break;
      // case 'files':
      //   isMenuFiles = true;
      //   break;
      case 'assets':
        isMenuAssets = true;
        break;
      default:
        break;
    }
    this.setState({
      isMenuService,
      // isMenuFiles,
      isMenuAssets,
    });
  }

  onEditorChange(newValue) {
    this.state.editorValue = newValue;
  }

  onStateChange(ip) {
    if (this.state.editorClient.ip === ip) {
      CServiceControllerEB.emit(CServiceControllerEB.EventDeviceStateChanged, ip, this.state.editorClient.connectState);
    }
  }

  onFileRead(e) {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    this.setState({ scriptPath: file.path });

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      this.setState({ editorValue: content });
    };
    reader.readAsText(file);
  }

  onFileSave() {
    try {
      fs.writeFileSync(this.state.scriptPath, this.state.editorValue, 'utf-8');
    } catch (e) {
      CLogsEB.emit(CLogsEB.EventNewLog, CLogsEB.TagDesktop, CLogsEB.LevelWarning, 'Unable save the file');
    }
  }

  onFileRun() {
    if (this.state.editorValue !== '') {
      this.onFileSave();
      console.log(this.state.editorValue);
      this.runScript(this.state.editorValue);
    }
  }

  onStop() {
    if (_.isUndefined(this.state.editorClient)) {
      return;
    }
    this.state.editorClient.client.runScript('stop();')
      .then(() => {
        CLogsEB.emit(CLogsEB.EventNewLog, this.state.editorClient.ip, CLogsEB.LevelInfo, 'stop script success');
      })
      .catch(() => {
        CLogsEB.emit(CLogsEB.EventNewLog, this.state.editorClient.ip, CLogsEB.LevelError, 'stop script failed');
      });
  }

  runScript(script) {
    this.state.editorClient.client.runScript(script)
      .then(() => {
        CLogsEB.emit(CLogsEB.EventNewLog, this.state.editorClient.ip, CLogsEB.LevelWarning, 'run script success');
      })
      .catch((e) => {
        CLogsEB.emit(CLogsEB.EventNewLog, this.state.editorClient.ip, CLogsEB.LevelError, `run script failed: ${e.message}`);
      });
  }

  runScriptByPath(scriptPath) {
    if (_.isUndefined(this.state.editorClient)) {
      return;
    }
    CLogsEB.emit(CLogsEB.EventNewLog, this.state.editorClient.ip, CLogsEB.LevelInfo, `run script > ${scriptPath}`);
    const js = fs.readFileSync(scriptPath);
    this.state.editorClient.client.runScript(js.toString())
      .then(() => {
        CLogsEB.emit(CLogsEB.EventNewLog, this.state.editorClient.ip, CLogsEB.LevelInfo, 'run script success');
      })
      .catch(() => {
        CLogsEB.emit(CLogsEB.EventNewLog, this.state.editorClient.ip, CLogsEB.LevelError, 'run script failed');
      });
  }

  render() {
    const menuSelectedStyle = 'button button-blue';
    const menuDefaultStyle = 'button button-menu';
    return (
      <div>
        <nav>
          <input type="file" onChange={this.onFileRead} />
          <button className="button" onClick={this.onFileSave}>Save</button>
          <button className="button button-green" onClick={this.onFileRun}>Run</button>
          <button className="button button-red" onClick={this.onStop}>Stop</button>
        </nav>
        <div id="container">
          <div id="menu">
            <button className={this.state.isMenuService ? menuSelectedStyle : menuDefaultStyle} onClick={() => this.onMenuChange('service')}><img src={menuPhoneIcon} /></button>
            {/* <button className={this.state.isMenuFiles ? menuSelectedStyle : menuDefaultStyle} onClick={() => this.onMenuChange('files')}><img src={menuFilesIcon} /></button> */}
            <button className={this.state.isMenuAssets ? menuSelectedStyle : menuDefaultStyle} onClick={() => this.onMenuChange('assets')}><img src={menuPhotoIcon} /></button>
          </div>
          <div id="browser">
            <ServiceController display={this.state.isMenuService} />
            <ScreenCrops editorClient={this.state.editorClient} display={this.state.isMenuAssets} />
          </div>
          <div id="main">
            <div id="editor">
              <AceEditor
                mode="javascript"
                theme="monokai"
                width="100%"
                height="100%"
                value={this.state.editorValue}
                onChange={this.onEditorChange}
                name="AceEditor"
                editorProps={{ $blockScrolling: Infinity }}
                fontSize={13}
                showPrintMargin
                showGutter
                highlightActiveLine
                setOptions={{
                  useWorker: true,
                  enableBasicAutocompletion: true,
                  enableLiveAutocompletion: true,
                  enableSnippets: true,
                  showLineNumbers: true,
                  tabSize: 2,
                }}
              />
            </div>
            <div id="console">
              <LogController />
            </div>
          </div>
          <div id="inspector">
            <div id="monitor">
              <ScreenController editorClient={this.state.editorClient} />
            </div>
          </div>
        </div>
      </div>
    );
  }
}
