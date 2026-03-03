import socket
import threading
from cryptography.fernet import Fernet

# Client Configuration
HOST = '127.0.0.1'
PORT = 55555

# Encryption Key (Must match server's SHARED_KEY)
SHARED_KEY = b'7_WzY-B8K3-Xq1u4vHqW_E0-m8y5-Z6x1n3vA9uB2c8='
cipher = Fernet(SHARED_KEY)

# Terminal Colors
COLOR_RESET = "\033[0m"
COLOR_CYAN = "\033[96m"
COLOR_GREEN = "\033[92m"
COLOR_RED = "\033[91m"

class ChatClient:
    def __init__(self):
        self.nickname = input("Choose your nickname: ")
        self.client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        
        try:
            self.client.connect((HOST, PORT))
        except ConnectionRefusedError:
            print(f"{COLOR_RED}[ERROR] Could not connect to server at {HOST}:{PORT}{COLOR_RESET}")
            exit()

    def receive(self):
        """Thread function to handle incoming messages."""
        while True:
            try:
                message = self.client.recv(4096)
                if not message:
                    break
                
                # Check for handshake keyword
                if message.decode('utf-8', errors='ignore') == 'NICK':
                    self.client.send(self.nickname.encode('utf-8'))
                else:
                    # Decrypt and display message
                    decrypted_message = cipher.decrypt(message).decode('utf-8')
                    print(f"\r{decrypted_message}\n{COLOR_CYAN}You: {COLOR_RESET}", end="")
            except Exception as e:
                print(f"\n{COLOR_RED}[DISCONNECTED] Connection to server lost.{COLOR_RESET}")
                self.client.close()
                break

    def write(self):
        """Function to handle user input and encryption."""
        print(f"{COLOR_GREEN}Joined the chat! Type your message below.{COLOR_RESET}")
        while True:
            try:
                text = input(f"{COLOR_CYAN}You: {COLOR_RESET}")
                if text.lower() == '/quit':
                    self.client.close()
                    break
                
                # Format: "Nickname: Message"
                full_message = f"{self.nickname}: {text}"
                # Encrypt the entire string
                encrypted_message = cipher.encrypt(full_message.encode('utf-8'))
                self.client.send(encrypted_message)
            except EOFError:
                break
            except Exception as e:
                print(f"{COLOR_RED}[ERROR] Message could not be sent.{COLOR_RESET}")
                break

    def start(self):
        # Start threads
        receive_thread = threading.Thread(target=self.receive)
        receive_thread.start()

        write_thread = threading.Thread(target=self.write)
        write_thread.start()

if __name__ == "__main__":
    client = ChatClient()
    client.start()