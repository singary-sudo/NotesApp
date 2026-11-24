import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Note, NotesService } from '../services/notes.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  notes: Note[] = [];
  searchText = '';
  isEditorOpen = false;
  draft: Note = this.createEmptyNote();
  saveStatus = 'Saved';
  private saveTimer?: ReturnType<typeof setTimeout>;

  // Photo preview state
  selectedPhoto: string | null = null;
  photoScale = 1;

  constructor(
    private notesService: NotesService,
    private alertController: AlertController,
    private toastController: ToastController,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadNotes();
  }

  ngOnDestroy(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
  }

  get filteredNotes(): Note[] {
    const term = this.searchText.trim().toLowerCase();
    if (!term) {
      return this.notes;
    }

    return this.notes.filter((note) =>
      `${note.title} ${note.content}`.toLowerCase().includes(term),
    );
  }

  async loadNotes(): Promise<void> {
    try {
      this.notes = await this.notesService.getNotes();
    } catch (error) {
      await this.showToast('Could not load notes');
      console.error(error);
    }
  }

  openNewNote(): void {
    this.draft = this.createEmptyNote();
    this.saveStatus = 'New note';
    this.isEditorOpen = true;
  }

  openNote(note: Note): void {
    this.draft = { ...note, photos: note.photos ?? [] };
    this.saveStatus = 'Saved';
    this.isEditorOpen = true;
  }

  scheduleAutoSave(): void {
    this.saveStatus = 'Saving...';
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      void this.saveNote(false);
    }, 700);
  }

  async saveNote(closeEditor = false): Promise<void> {
    const title = this.draft.title.trim();
    const content = this.draft.content.trim();

    if (!title && !content && this.draft.photos.length === 0) {
      this.saveStatus = 'Empty';
      return;
    }

    this.draft.title = title;
    this.draft.content = content;
    this.draft.updatedAt = Date.now();

    try {
      await this.notesService.saveNote(this.draft);
      await this.loadNotes();
      this.saveStatus = 'Saved';

      if (closeEditor) {
        this.isEditorOpen = false;
      }
    } catch (error) {
      this.saveStatus = 'Not saved';
      await this.showToast('Could not save the note');
      console.error(error);
    }
  }

  async takePhoto(source: CameraSource): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        width: 1200,
        height: 1200,
        resultType: CameraResultType.DataUrl,
        source,
      });

      if (photo.dataUrl) {
        this.draft.photos = [...this.draft.photos, photo.dataUrl];
        this.scheduleAutoSave();
      }
    } catch (error) {
      console.error(error);
    }
  }

  takeCameraPhoto(): void {
    void this.takePhoto(CameraSource.Camera);
  }

  chooseLibraryPhoto(): void {
    void this.takePhoto(CameraSource.Photos);
  }

  removePhoto(index: number): void {
    this.draft.photos = this.draft.photos.filter((_, photoIndex) => photoIndex !== index);
    this.scheduleAutoSave();
  }

  async confirmDelete(note: Note): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Delete note?',
      message: `“${note.title || 'Untitled'}” will be permanently removed.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.deleteNote(note),
        },
      ],
    });

    await alert.present();
  }

  async deleteNote(note: Note): Promise<void> {
    try {
      await this.notesService.deleteNote(note.id);
      if (this.draft.id === note.id) {
        this.isEditorOpen = false;
      }
      await this.loadNotes();
      await this.showToast('Note deleted');
    } catch (error) {
      await this.showToast('Could not delete the note');
      console.error(error);
    }
  }

  formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(timestamp);
  }

  private createEmptyNote(): Note {
    return {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      title: '',
      content: '',
      photos: [],
      updatedAt: Date.now(),
    };
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 1800,
      position: 'bottom',
    });
    await toast.present();
  }

  openPhoto(photo: string, event?: Event): void {
    event?.stopPropagation();
    this.selectedPhoto = photo;
    this.photoScale = 1;
  }

  closePhoto(): void {
    this.selectedPhoto = null;
    this.photoScale = 1;
  }

  zoomPhoto(amount: number): void {
    this.photoScale = Math.min(4, Math.max(1, this.photoScale + amount));
  }
}
