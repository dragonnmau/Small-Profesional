import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Db, DbAccountInformation, UserType } from '../../../services/db';

type PersonType = 'Fisica' | 'Moral';

interface BusinessForm {
  commercialName: string;
  personType: PersonType;
  companyRfc: string;
  address: string;
}

interface UserForm {
  name: string;
  rfc: string;
  password: string;
  email: string;
  phone: string;
  extension: string;
  mobile: string;
  userType: UserType;
}

@Component({
  selector: 'app-informacion',
  imports: [CommonModule, FormsModule],
  templateUrl: './informacion.html',
  styleUrl: './informacion.scss'
})
export class Informacion implements OnInit {
  isAdmin = true;
  businessImage = '';
  profileImage = '';
  saveState: 'idle' | 'saving' | 'saved' | 'error' = 'idle';

  businessForm: BusinessForm = {
    commercialName: '',
    personType: 'Fisica',
    companyRfc: '',
    address: ''
  };

  userForm: UserForm = {
    name: '',
    rfc: '',
    password: '',
    email: '',
    phone: '',
    extension: '',
    mobile: '',
    userType: 'admin'
  };

  constructor(private readonly dbService: Db) {}

  ngOnInit(): void {
    const information = this.dbService.getAccountInformation();
    if (!information) return;

    this.businessForm = { ...information.business };
    this.userForm = { ...information.user };
    this.businessImage = information.business.image;
    this.profileImage = information.user.image;
    this.isAdmin = information.user.userType === 'admin';
  }

  selectImage(event: Event, imageType: 'business' | 'profile'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const imageData = String(reader.result ?? '');
      if (imageType === 'business') this.businessImage = imageData;
      else this.profileImage = imageData;
    };
    reader.readAsDataURL(file);
  }

  saveInformation(): void {
    this.saveState = 'saving';
    this.businessForm.companyRfc = this.businessForm.companyRfc.trim().toUpperCase();
    this.userForm.rfc = this.userForm.rfc.trim().toUpperCase();

    const information: DbAccountInformation = {
      business: { ...this.businessForm, image: this.businessImage },
      user: { ...this.userForm, image: this.profileImage }
    };

    try {
      this.dbService.saveAccountInformation(information);
      this.saveState = 'saved';
    } catch {
      this.saveState = 'error';
    }
  }

}
