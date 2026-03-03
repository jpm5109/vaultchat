import socket
import threading

# Server Configuration
HOST = '127.0.0.1'  # Localhost
PORT = 55555        # Port to listen on

# Shared key (Must be 32 url-safe base64-encoded bytes)
# In a real-world app, this would be exchanged via RSA/Diffie-Hellman
# For this workable system, ensure both server and client use the same key
# You can generate a new one using Fernet.generate_key()
SHARED_KEY = b'7_WzY-B8K3-Xq1u4vHqW_E0-m8y5-Z6x1n3vA9uB2c8='

class ChatServer:
    def __init__(self):
        self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server.bind((HOST, PORT))
        self.server.listen()
        self.clients = []
        self.nicknames = []
        print(f"[STARTING] Server is listening on {HOST}:{PORT}")

    def broadcast(self, message, sender_client=None):
        """Sends a message to all connected clients except the sender."""
        for client in self.clients:
            if client != sender_client:
                try:
                    client.send(message)
                except:
                    self.remove_client(client)

    def handle_client(self, client):
        """Handles the continuous communication with a single client."""
        while True:
            try:
                # The server doesn't decrypt; it just forwards the encrypted blobs
                message = client.recv(4096)
                if not message:
                    break
                self.broadcast(message, client)
            except:
                break
        
        self.remove_client(client)

    def remove_client(self, client):
        """Cleans up when a client disconnects."""
        if client in self.clients:
            index = self.clients.index(client)
            nickname = self.nicknames[index]
            print(f"[DISCONNECTED] {nickname} left the chat.")
            self.clients.remove(client)
            self.nicknames.remove(client)
            client.close()

    def receive(self):
        """Main loop to accept new connections."""
        while True:
            client, address = self.server.accept()
            print(f"[CONNECTED] Connected with {str(address)}")

            # Ask for nickname (sent in plaintext during handshake)
            client.send("NICK".encode('utf-8'))
            nickname = client.recv(1024).decode('utf-8')
            self.nicknames.append(nickname)
            self.clients.append(client)

            print(f"[NICKNAME] Nickname of client is {nickname}")
            
            # Start handling thread for this client
            thread = threading.Thread(target=self.handle_client, args=(client,))
            thread.start()

if __name__ == "__main__":
    chat_server = ChatServer()
    chat_server.receive()