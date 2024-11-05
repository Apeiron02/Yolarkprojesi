from django.contrib.auth.models import AbstractUser

# Create your models here.

# models.py
from django.db import models

class Users(models.Model):
    username = models.CharField(max_length=150)
    email = models.EmailField()
    password = models.CharField(max_length=128)

    def __str__(self):
        return self.username
