from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.models import User
from django.db import IntegrityError

def register_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')

        try:
            # Django'nun User modelini kullanarak yeni kullanıcı oluştur
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password  # create_user otomatik olarak şifreyi hashler
            )
            
            messages.success(request, 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.')
            return redirect('/giris/')
            
        except IntegrityError:
            messages.error(request, 'Bu kullanıcı adı veya e-posta zaten kullanımda!')
        except Exception as e:
            messages.error(request, 'Kayıt sırasında bir hata oluştu!')
            
    return render(request, 'kayitol/kayitol.html')

def giris(request):
    return render(request,'giris.html')

