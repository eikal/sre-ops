import { Client } from 'ssh2';
import util from 'util';

const sshConn = (socket, sshUsername) => {
  try {
    // executed when new 'connection' event generated by new socket from client
    console.log(`sshConn - trying to setup sshConn with SOCKETID: ${socket?.id} for HOST: ${socket.handshake.query.host}, USER: ${socket.handshake.query.username}`);

    // the socket open connection to ssh
    const conn = new Client();

    conn.on('banner', (data) => {
      // need to convert to cr/lf for proper formatting
      socket.emit('data', data.replace(/\r?\n/g, '\r\n').replace('NOTICE TO USERS', 'Welcome to Cloudshell').toString('utf-8'));
    });

    conn.on('ready', async () => {
      await new Promise(resolve => setTimeout(resolve, 500)); // wait 0.5 sec until geomtry will fire rows/cols
      console.log(`sshConn - WebSSH2 Login: USER=${socket.handshake.query.username} HOST=${socket.handshake.query.host} SESSION_ID=${socket.request.sessionID} SOCKET_ID:${socket.id}`);
      socket.emit('menu');
      socket.emit('setTerminalOpts', socket.request.session.ssh.terminal);
      socket.emit('title', `ssh://${socket.handshake.query.host}`);
      socket.emit('footer', `ssh://${sshUsername}(${socket.handshake.query.username})@${socket.handshake.query.host}:${socket.handshake.query.port}`);
      socket.emit('status', 'SSH CONNECTION ESTABLISHED');
      socket.emit('statusBackground', 'green');
      const term = socket.request.session.ssh.term;
      const { cols, rows } = socket.request.session.ssh.terminfo;
      conn.shell({ term, cols, rows }, (err, stream) => {
        if (err) {
          logError(socket, 'SSH ERROR -- Error', err);
          conn.end();
          socket.disconnect(true);
          return;
        }
        socket.once('disconnect', (reason) => {
          console.log(`CLIENT SOCKET DISCONNECT: ${reason} -- USER=${socket.handshake.query.username} HOST=${socket.handshake.query.host} SOCKET_ID:${socket.id}`);
          conn.end();
          socket.request.session.destroy();
        });
        socket.on('error', (errMsg) => {
          console.log(`SOCKET ERROR: ${errMsg} -- USER=${socket.handshake.query.username} HOST=${socket.handshake.query.host}`);
          logError(socket, 'SOCKET ERROR', errMsg);
          conn.end();
          socket.disconnect(true);
        });
        socket.on('control', (controlData) => {
          if (controlData === 'replayCredentials' && socket.request.session.ssh.allowreplay) {
            stream.write(`${socket.request.session.userpassword}\n`);
          }
          if (controlData === 'reauth' && socket.handshake.query.username) {
            console.log(`LOGOUT -- USER=${socket.handshake.query.username} HOST=${socket.handshake.query.host}`);
            conn.end();
            socket.disconnect(true);
          }
          console.log(`SOCKET CONTROL: ${controlData} --  USER=${socket.handshake.query.username} HOST=${socket.handshake.query.host}`);
        });
        socket.on('resize', (data) => {
          stream.setWindow(data.rows, data.cols);
          console.log(`SOCKET RESIZE: ${JSON.stringify([data.rows, data.cols])} --  USER=${socket.handshake.query.username} HOST=${socket.handshake.query.host}`);
        });
        socket.on('data', (data) => {
          stream.write(data);
        });
        stream.on('data', (data) => {
          socket.emit('data', data.toString('utf-8'));
        });
        stream.on('close', (code, signal) => {
          console.log(`STREAM CLOSE: --  USER=${socket.handshake.query.username} HOST=${socket.handshake.query.host}`);
          if (socket.request.session?.username) {
            console.log(`STREAM CLOSE LOGOUT --  USER=${socket.handshake.query.username} HOST=${socket.handshake.query.host}`);
          }
          if (code !== 0 && typeof code !== 'undefined') {
            logError(socket, 'STREAM CLOSE', code);
          }
          socket.disconnect(true);
          conn.end();
        });
        stream.stderr.on('data', (data) => {
          console.error(`STREAM STDERR: ${data} -- USER=${socket.handshake.query.username} HOST=${socket.handshake.query.host}`);
        });
      });
    });

    conn.on('end', (err) => {
      if (err) {
        logError(socket, 'CONN END BY HOST', err);
      }
      console.log(`CONN END -- USER=${socket.handshake.query.username} HOST=${socket.handshake.query.host}`);
      socket.disconnect(true);
    });

    conn.on('close', (err) => {
      if (err) {
        logError(socket, 'CONN CLOSE', err);
      }
      console.log(`CONN CLOSE -- USER=${socket.handshake.query.username} HOST=${socket.handshake.query.host}`);

      socket.disconnect(true);
    });

    conn.on('error', (err) => connError(socket, err));

    conn.on('keyboard-interactive', (_name, _instructions, _instructionsLang, _prompts, finish) => {
      console.log(`CONN keyboard-interactive -- USER=${socket.handshake.query.username} HOST=${socket.handshake.query.host}`);
      finish([socket.request.session.userpassword]);
    });

    return conn;
  } catch (ex) {
    logError(socket, 'sshConn -- Error while trying setup ssh connectoin', JSON.stringify(ex.message));
  }
};

const connError = (socket, err) => {
  let msg = util.inspect(err);
  const { session } = socket.request;
  if (err?.level === 'client-authentication') {
    msg = `Authentication failure user=${session.username} from=${socket.handshake.address}`;
    socket.emit('allowreauth', session.ssh.allowreauth);
    socket.emit('reauth');
  }
  if (err?.code === 'ENOTFOUND') {
    msg = `Host not found: ${err.hostname}`;
  }
  if (err?.level === 'client-timeout') {
    msg = `Connection Timeout: ${session.ssh.host}`;
  }
  logError(socket, 'CONN ERROR', msg);
};

const logError = (socket, myFunc, err) => {
  console.error(`WebSSH2 ${prefix(socket)} ERROR: ${myFunc}: ${err}`);
  if (!socket.request.session) return;
  socket.emit('ssherror', `SSH ${myFunc}: ${err}`);
};

const prefix = (socket) => {
  return `(${socket.request.sessionID}/${socket.id})`;
};

export default sshConn;
