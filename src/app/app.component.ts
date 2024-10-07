import {Component, ElementRef, OnInit, QueryList, ViewChild, ViewChildren} from '@angular/core';
import {ChatServiceService} from "./service/chat-service.service";
import {Chat, Message, User} from "./model/models";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  chats: Chat[] = [];
  messages: Message[] = [];
  selectedChatUser?: User;
  currentUserId = 'user123';
  // currentLoggedUser: User = {id: 'user-1234', name: 'Romain Perara', avatar: '../assets/profile/my-pic.png'}
  currentLoggedUser: User = {id: 'user-4321', name: 'Randy Ortan', avatar: '../assets/profile/my-pic.png'}
  newMessage: string = '';
  selectChatId: string = '';
  lastVisibleMessage?: Message;
  firstVisibleMessage?: Message;
  locationId = 'location1';
  loadingMoreMessages: boolean = false;
  loadingNewMessages: boolean = false;
  hasMoreMessages: boolean = true;
  messagesPageSize: number = 10;

  @ViewChild('messageContainer') messageContainer!: ElementRef;
  @ViewChildren('messageElement') messageElements!: QueryList<ElementRef>;
  searchChatTerm: string = '';
  searchMessageTerm: string = '';
  foundChats: Chat[] = [];
  foundMessages: Message[] = [];

  constructor(private chatService: ChatServiceService) {
  }

  ngOnInit() {
    this.loadInitialChats();
  }

  loadInitialChats() {

    this.chatService.getChatsByLocation(this.locationId).subscribe((chats) => {
      this.chats = chats;
      console.log('Chats with IDs:', chats);

      if (this.chats.length > 0) {
        const lastChat = this.chats[0];

        if (!this.selectChatId) {
          this.selectChat(lastChat.id);
        }
      }
    });
    console.log(this.chats);
  }

  selectChat(chatId: string): void {
    this.selectChatId = chatId;
    this.chatService.getMessagesByChat(this.locationId, this.selectChatId, this.messagesPageSize).subscribe(messages => {
      this.selectedChatUser = messages[1]?.senderId;
      this.messages = messages;
      // Store the last visible message
      this.firstVisibleMessage = messages[0];
      this.lastVisibleMessage = messages[messages.length - 1];
      if (messages.length < this.messagesPageSize) {
        this.hasMoreMessages = false;
      }
      console.log(messages);
      this.scrollToBottom();
    });

  }

  onScroll(event: any) {
    const target = event.target;
    if (target.scrollTop === 0) {
      this.loadMoreMessages('up');
    }
    if (target.scrollHeight - target.scrollTop === target.clientHeight) {
      this.loadMoreMessages('down');
    }
  }

  loadMoreMessages(direction: 'up' | 'down') {
    if (direction === 'up') {
      if (this.loadingMoreMessages || !this.hasMoreMessages) {
        return;
      }
      this.loadingMoreMessages = true;

      this.chatService.getMessagesByChat(this.locationId, this.selectChatId, this.messagesPageSize, this.lastVisibleMessage).subscribe(messages => {
        if (messages.length > 0) {
          this.messages = [...messages, ...this.messages];
          this.lastVisibleMessage = messages[messages.length - 1];

          if (messages.length < 10) {
            this.hasMoreMessages = false;
          }
        } else {
          this.hasMoreMessages = false;
        }
        this.loadingMoreMessages = false;
      });
    } else if (direction === 'down') {
      if (this.loadingNewMessages) {
        return;
      }
      this.loadingNewMessages = true;

      this.chatService.getMessagesByChat(this.locationId, this.selectChatId, this.messagesPageSize, undefined, this.firstVisibleMessage).subscribe(messages => {
        if (messages.length > 0) {
          this.messages = [...this.messages, ...messages];
          this.firstVisibleMessage = messages[0];
        }
        this.loadingNewMessages = false;
      });
    }
  }

  sendMessage() {

    const chatId = 'chat-44';

    if (this.newMessage.trim()) {
      this.chatService.sendMessage(this.locationId, this.selectChatId, this.newMessage, this.currentLoggedUser)
        .then(() => {
          this.newMessage = '';
        })
        .catch((error) => {
          console.error('Error sending message:', error);
        });
    }
  }

  getChatsForLocation() {
    this.chatService.getChatsByLocation(this.locationId).subscribe(chats => {
      console.log(chats);
      this.chats = chats;
    });
  }

  getAllLocations() {
    this.chatService.getLocations().subscribe(locations => {
      console.log(locations);
    });
  }

  scrollToBottom(): void {
    try {
      setTimeout(() => {
        this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
      }, 0);
    } catch (err) {
      console.error('Scroll error:', err);
    }
  }

  async onChatSearch(): Promise<void> {
    console.log(this.searchChatTerm);
    if (this.searchChatTerm.trim()) {
      // this.foundChats = await this.chatService.searchChatsByMessageContent(this.searchTerm);
      this.foundChats = await this.chatService.searchChatsByUserName(this.searchChatTerm);
      console.log(this.foundChats);
      if (this.foundChats.length > 0) {
        this.selectChat(this.foundChats[0].id);
      }
    }
  }

  async onMessageSearch(): Promise<void> {
    console.log(this.searchMessageTerm);
    if (this.searchMessageTerm.trim()) {
      this.foundMessages = await this.chatService.searchMessagesInChat(this.selectChatId , this.locationId, this.searchMessageTerm );
      console.log(this.foundMessages);
      if (this.foundMessages.length > 0) {
        this.messages = this.foundMessages; // Update the displayed messages if you want
        this.scrollToMessage(this.foundMessages[0].id); // Scroll to the first found message
      } else {
        console.log('No messages found matching the search term.');
      }
    }
  }

  scrollToMessage(messageId: string): void {
    const targetMessage = this.messageElements.find(
      (message) => message.nativeElement.id === messageId
    );

    if (targetMessage) {
      targetMessage.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetMessage.nativeElement.classList.add('highlighted'); // Add a highlight class
      setTimeout(() => {
        targetMessage.nativeElement.classList.remove('highlighted'); // Remove highlight after 2 seconds
      }, 2000);
    }
  }

}
