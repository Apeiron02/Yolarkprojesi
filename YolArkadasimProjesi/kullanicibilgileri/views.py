from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from kayitol.models import Users
@login_required  # Bu dekoratör, yalnızca giriş yapmış kullanıcıların erişebilmesini sağlar
def kullanici_bilgileri(request):
    if request.user.is_authenticated:
        return render(request, 'kullanicibilgileri/kullanici_bilgileri.html', {'Users': request.user})
    else:
        return redirect('/giris/')  # Kullanıcı giriş yapmamışsa yönlendir