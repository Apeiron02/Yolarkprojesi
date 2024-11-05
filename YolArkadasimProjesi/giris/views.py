from django.shortcuts import render, redirect
from django.contrib import messages
from kayitol.models import Users  # Kendi User modelinizi buradan import edin


def giris_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        try:
            user = Users.objects.get(username=username)
            if user.password == password:
                # Kullanıcıyı oturum açtır
                request.session['user_id'] = user.id
                return redirect('/anasayfa/')
            else:
                messages.error(request, "Geçersiz kullanıcı adı veya şifre.")
        except Users.DoesNotExist:
            messages.error(request, "Geçersiz kullanıcı adı veya şifre.")

    return render(request, 'giris/giris.html')  # Formu yeniden göster
