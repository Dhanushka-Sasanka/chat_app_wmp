import {Injectable} from '@angular/core';
import {Observable} from "rxjs";
import {Chat, Location, Message, User} from "../model/models";
import {
  addDoc,
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where
} from "@angular/fire/firestore";

@Injectable({
  providedIn: 'root'
})
export class ChatServiceService {

  chatList: Chat[] = [];
  users: User[] = [
    {id: '123', name: 'ABC', avatar: 'src/assets/profile/my-pic.png'},
    {id: '526', name: 'XYZ', avatar: 'src/assets/profile/my-pic.png'}
  ]
  locationId: string = 'location1';

  constructor(private firestore: Firestore) {
  }

  getAllChatsWithLatestMessage(): Observable<Chat[]> {
    return new Observable((observer) => {
      const chatRef = collection(this.firestore, 'chats');

      const unsubscribe = onSnapshot(chatRef, (snapshot) => {
        this.chatList = [];
        console.log(this.chatList);
        console.log(chatRef);
        snapshot.docChanges().forEach((change) => {
          let chat: any = change.doc.data();
          chat.id = change.doc.id;

          if (change.type === "added") {
            console.log("New chat: ", chat);
            this.chatList.push(chat);
          }
          if (change.type === "modified") {
            console.log("Modified chat: ", chat);
            const index = this.chatList.findIndex((x) => x.id === chat.id);
            this.chatList[index] = chat;
          }
          if (change.type === "removed") {
            console.log("Removed chat: ", chat);
            this.chatList = this.chatList.filter((x) => x.id !== chat.id);
          }
        });
        console.log(this.chatList);
        observer.next(this.chatList);
      });


      return () => unsubscribe();
    });

  }

  getDateAndTime() {
    const currDate = new Date();
    const dateStr: string = currDate.toDateString();
    console.log(dateStr);
    return dateStr;
  }

  async sendMessage(locationId: string, chatId: string | null, content: string, sender: User): Promise<void> {
    try {
      const chatsRef = collection(this.firestore, `locations/${locationId}/chats`);


      let chatRef;
      if (!chatId) {

        const newChat: Partial<Chat> = {
          createdAt: Timestamp.now(),
          locationId: locationId,
          chatUser: sender,
          latestMessage: {
            content: content,
            timestamp: Timestamp.now(),
            senderId: sender
          }
        };

        const chatDocRef = await addDoc(chatsRef, newChat);
        chatId = chatDocRef.id;
        chatRef = chatDocRef;
      } else {

        chatRef = doc(this.firestore, `locations/${locationId}/chats/${chatId}`);
        const chatSnapshot = await getDoc(chatRef);
        if (!chatSnapshot.exists()) {
          const newChat: Partial<Chat> = {
            createdAt: Timestamp.now(),
            locationId: locationId,
            chatUser: sender,
            latestMessage: {
              content: content,
              timestamp: Timestamp.now(),
              senderId: sender
            }
          };
          await setDoc(chatRef, newChat);
        }
      }

      const messagesRef = collection(chatRef, 'messages');

      const newMessage: Message = {
        id: '',
        content: content,
        senderId: sender,
        timestamp: Timestamp.now(),
        readStatus: false
      };


      const messageDocRef = await addDoc(messagesRef, newMessage);
      newMessage.id = messageDocRef.id;

      const latestMessageUpdate: Partial<Chat> = {
        latestMessage: {
          content: newMessage.content,
          timestamp: newMessage.timestamp,
          senderId: sender
        }
      };


      await updateDoc(chatRef, latestMessageUpdate);

      console.log('Message sent successfully:', newMessage.id);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }


  getMessagesByChat(locationId: string, chatId: string, limitSize: number, lastVisibleMessage?: Message, firstVisibleMessage?: Message): Observable<Message[]> {
    return new Observable((observer) => {
      const messagesRef = collection(this.firestore, `locations/${locationId}/chats/${chatId}/messages`);
      let q;

      if (lastVisibleMessage) {

        q = query(
          messagesRef,
          orderBy('timestamp', 'asc'),
          startAfter(lastVisibleMessage.timestamp),
          limit(limitSize)
        );
      } else if (firstVisibleMessage) {

        q = query(
          messagesRef,
          orderBy('timestamp', 'asc'),
          startAfter(firstVisibleMessage.timestamp),
          limit(limitSize)
        );
      } else {

        q = query(
          messagesRef,
          orderBy('timestamp', 'asc')

        );
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesList: Message[] = [];
        snapshot.forEach((doc) => {
          const message = doc.data() as Message;
          message.id = doc.id;
          if (!message.readStatus) {
            this.markMessageAsRead(locationId, chatId, message.id);
          }
          messagesList.push(message);
        });
        observer.next(messagesList);
        console.log(messagesList);
      });
      return () => unsubscribe();
    });
  }

  getChatsByLocation(locationId: string):
    Observable<Chat[]> {
    return new Observable((observer) => {
      const chatsRef = collection(this.firestore, `locations/${locationId}/chats`);
      console.log(`locations/${locationId}/chats`);
      const q = query(chatsRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const chatList: Chat[] = [];

        const promises = snapshot.docs.map(async (doc) => {
          const chat = doc.data() as Chat;
          chat.id = doc.id;

          const unreadMessagesRef = collection(this.firestore, `locations/${locationId}/chats/${doc.id}/messages`);
          const unreadQuery = query(unreadMessagesRef, where('readStatus', '==', false));
          const unreadSnapshot = await getDocs(unreadQuery);

          chat.unreadCount = unreadSnapshot.size;

          chatList.push(chat);
        });

        await Promise.all(promises);

        observer.next(chatList);
      });

      return () => unsubscribe();
    });
  }

  async markMessageAsRead(locationId: string, chatId: string, messageId: string): Promise<void> {
    const messageRef = doc(this.firestore, `locations/${locationId}/chats/${chatId}/messages/${messageId}`);

    try {
      await updateDoc(messageRef, {readStatus: true});
      console.log('Message marked as read:', messageId);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  getLocations(): Observable<Location[]> {
    return new Observable((observer) => {
      const locationsRef = collection(this.firestore, 'locations');

      const unsubscribe = onSnapshot(locationsRef, (snapshot) => {
        const locationList: Location[] = [];
        snapshot.forEach((doc) => {
          const location = doc.data() as Location;
          location.locationId = doc.id;
          locationList.push(location);
        });
        observer.next(locationList);
      });

      return () => unsubscribe();
    });
  }

  addDummyData(locationId: string, chatId: string, content: string, sender: User) {
    const locationRef = doc(this.firestore, 'locations');
    setDoc(locationRef, {
      locationId: '123456'
    });


    const chatRef = doc(collection(locationRef, 'chats'),);
    setDoc(chatRef, {
      createdAt: new Date(),
      latestMessage: {
        content: 'Hello, how can I help you?',
        timestamp: new Date(),
        senderId: 'user1'
      }
    });


    const messagesRef = collection(chatRef, 'messages');
    addDoc(messagesRef, {
      content: 'I help you?',
      timestamp: new Date(),
      senderId: 'user1'
    });

  }

}

