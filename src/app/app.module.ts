import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {environment} from "../environments/environment";


import {AngularFirestore} from "@angular/fire/compat/firestore";
import {FormsModule} from "@angular/forms";
import {getFirestore, provideFirestore} from "@angular/fire/firestore";
import {initializeApp, provideFirebaseApp} from "@angular/fire/app";
import { DateDisplayPipe } from './pipe/date-display.pipe';
import {DatePipe} from "@angular/common";

@NgModule({
  declarations: [
    AppComponent,
    DateDisplayPipe,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
  ],
  providers: [
    // AngularFirestore,
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideFirestore(() => getFirestore()),
    DatePipe
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
