from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from harita.models import RouteHistory

@login_required
def kullanici_bilgileri(request):
    user_routes = RouteHistory.objects.filter(user=request.user).order_by('-created_at')
    return render(request, 'kullanicibilgileri/kullanici_bilgileri.html', {
        'user': request.user,
        'routes': user_routes
    })