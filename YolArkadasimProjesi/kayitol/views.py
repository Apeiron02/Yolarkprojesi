from django.shortcuts import render, redirect
from .models import Users
from django.contrib import messages

def register_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')



        user = Users(username=username, email=email, password=password)
        user.save()

        messages.success(request, 'Kayıt başarılı!')


        return redirect('/giris/')
    return render(request, 'kayitol/kayitol.html')

def giris(request):
    return render(request,'giris.html')

