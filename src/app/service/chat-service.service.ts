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

  // Fetch all chats with only the latest message
  getAllChatsWithLatestMessage(): Observable<Chat[]> {
    return new Observable((observer) => {
      const chatRef = collection(this.firestore, 'chats'); // Fetch the chats collection
      // Subscribe to real-time updates on the chats collection
      const unsubscribe = onSnapshot(chatRef, (snapshot) => {
        this.chatList = [];  // Clear the chat list
        console.log(this.chatList);
        console.log(chatRef);
        snapshot.docChanges().forEach((change) => {
          let chat: any = change.doc.data();
          chat.id = change.doc.id;

          // Handle changes to the chat documents
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
        observer.next(this.chatList);  // Emit the chat list with latest messages
      });

      // Unsubscribe from the Firestore listener when the Observable is unsubscribed.
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
      // Reference to the chat collection inside the specific location
      const chatsRef = collection(this.firestore, `locations/${locationId}/chats`);

      // Check if a new chat needs to be created
      let chatRef;
      if (!chatId) {
        // No chatId provided, so create a new chat
        const newChat: Partial<Chat> = {
          createdAt: Timestamp.now(),
          locationId: locationId,
          chatUser: sender, // Set the current sender as a participant in the chat
          latestMessage: {
            content: content,
            timestamp: Timestamp.now(),
            senderId: sender
          }
        };
        // Create a new chat document in Firestore and get the reference
        const chatDocRef = await addDoc(chatsRef, newChat);
        chatId = chatDocRef.id;  // Get the auto-generated chatId
        chatRef = chatDocRef; // Use the newly created chat reference
      } else {
        // Use the existing chatId if provided
        chatRef = doc(this.firestore, `locations/${locationId}/chats/${chatId}`);
        const chatSnapshot = await getDoc(chatRef);
        if (!chatSnapshot.exists()) {
          // If the provided chatId doesn't exist, create a new chat
          const newChat: Partial<Chat> = {
            createdAt: Timestamp.now(),
            locationId: locationId,
            chatUser: sender, // Set the current sender as a participant in the chat
            latestMessage: {
              content: content,
              timestamp: Timestamp.now(),
              senderId: sender
            }
          };
          await setDoc(chatRef, newChat); // Create the new chat with the given chatId
        }
      }

      // Now that we have a chat (either new or existing), reference the messages sub-collection
      const messagesRef = collection(chatRef, 'messages');

      // Create a new message object
      const newMessage: Message = {
        id: '', // Will be assigned once Firestore generates an ID
        content: content,
        senderId: sender, // Use the sender's ID from the User object
        timestamp: Timestamp.now(), // Timestamp of when the message is sent
        readStatus: false // Mark it as unread initially
      };

      // Add the message to the messages sub-collection
      const messageDocRef = await addDoc(messagesRef, newMessage);
      newMessage.id = messageDocRef.id; // Update the message with the generated ID

      // Update the latestMessage in the chat document
      const latestMessageUpdate: Partial<Chat> = {
        latestMessage: {
          content: newMessage.content,
          timestamp: newMessage.timestamp,
          senderId: sender // Update with the sender's ID
        }
      };

      // Update the chat document with the latest message
      await updateDoc(chatRef, latestMessageUpdate);

      console.log('Message sent successfully:', newMessage.id);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error; // Re-throw the error so it can be handled in the calling function
    }
  }

// Retrieve messages for a specific chat
  getMessagesByChat(locationId: string, chatId: string, limitSize: number, lastVisibleMessage?: Message, firstVisibleMessage?: Message): Observable<Message[]> {
    return new Observable((observer) => {
      const messagesRef = collection(this.firestore, `locations/${locationId}/chats/${chatId}/messages`);
      // const q = query(messagesRef, orderBy('timestamp'));
      let q;

      if (lastVisibleMessage) {
        // Fetch older messages (scroll up)
        q = query(
          messagesRef,
          orderBy('timestamp', 'asc'),  // Ascending order for old to new
          startAfter(lastVisibleMessage.timestamp),  // Start after the last visible message
          limit(limitSize)  // Limit to the number of messages
        );
      } else if (firstVisibleMessage) {
        // Fetch newer messages (scroll down)
        q = query(
          messagesRef,
          orderBy('timestamp', 'asc'),  // Ascending order for old to new
          startAfter(firstVisibleMessage.timestamp),  // Start after the first visible message
          limit(limitSize)  // Limit to the number of messages
        );
      } else {
        // Initial message load (first batch of messages)
        q = query(
          messagesRef,
          orderBy('timestamp', 'asc')  // Ascending order for initial load
          // Limit to the number of messages
        );
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesList: Message[] = [];
        snapshot.forEach((doc) => {
          const message = doc.data() as Message;
          message.id = doc.id;
          // If the message is unread and the user is viewing it, mark it as read
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

// Retrieve all chats for a specific location
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

          // Query unread messages for this chat
          const unreadMessagesRef = collection(this.firestore, `locations/${locationId}/chats/${doc.id}/messages`);
          const unreadQuery = query(unreadMessagesRef, where('readStatus', '==', false));
          const unreadSnapshot = await getDocs(unreadQuery);

          // Add unread count to the chat object
          chat.unreadCount = unreadSnapshot.size;

          chatList.push(chat);
        });

        // Wait for all unread count queries to finish
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

// Retrieve all locations
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
    // Add Location
    const locationRef = doc(this.firestore, 'locations');
    setDoc(locationRef, {
      locationId: '123456'
    });

    // Add Chat
    const chatRef = doc(collection(locationRef, 'chats'),);
    setDoc(chatRef, {
      createdAt: new Date(),
      latestMessage: {
        content: 'Hello, how can I help you?',
        timestamp: new Date(),
        senderId: 'user1'
      }
    });

    // Add Message
    const messagesRef = collection(chatRef, 'messages');
    addDoc(messagesRef, {
      content: 'I help you?',
      timestamp: new Date(),
      senderId: 'user1'
    });

  }

}

